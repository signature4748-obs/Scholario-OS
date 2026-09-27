'use client'

/**
 * useAdmissionWizard — central state + handlers for the admission form wizard.
 *
 * Extracted from the original admission.tsx monolith (Task ID: 21).
 * Holds wizard step state, the visible-steps computation, the field setter
 * (with permanent-address auto-sync), step navigation, post-submit duplicate
 * detection flow, and the auto-save-draft side effect.
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { students } from '@/lib/mock/students'
import { toast } from 'sonner'
import { useAdmissionStore } from '@/lib/store/admission-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import {
  useAdmissionFeatureFlags,
  useDuplicateDetectionConfig,
  checkDuplicates,
  type DuplicateMatch,
} from './admission-utils'
import { evaluateRequiredDocs } from './documents'
import {
  STEPS,
  createBlankData,
  initialData,
  type FormData,
} from '../constants'
import type { FeeDataState } from '../../FeeStructureStep'

export function useAdmissionWizard() {
  const admissionStore = useAdmissionStore()
  const flags = useAdmissionFeatureFlags()
  const dupConfig = useDuplicateDetectionConfig()

  const [viewMode, setViewMode] = useState<'list' | 'form'>('list')
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(initialData)

  // Stepper auto-scroll ref — effect wired after currentVisibleIndex is computed
  const stepperScrollRef = useRef<HTMLDivElement>(null)

  // Compute visible steps — auto-skip Previous School for pre-primary classes
  const visibleSteps = useMemo(() => {
    return STEPS.filter((s) => {
      // Personal (1), Parents (2), Address (3), Applying For (4) — always
      if (s.id <= 4) return true
      // Previous School (5) — auto-skip for Nursery/LKG/UKG/Class 1
      if (s.id === 5) {
        const cls = (data.className || '').toLowerCase()
        const skipClasses = flags.previousSchoolSkipClasses.map((c) => c.toLowerCase())
        const isPrePrimary = skipClasses.some((sc) => cls.includes(sc))
        if (isPrePrimary) return false
        return flags.enablePreviousSchool
      }
      // Transport (6) — conditional on transport/hostel facility
      if (s.id === 6) return flags.enableTransport || flags.enableHostel
      // Fee (7), Review (10) — always
      if (s.id === 7 || s.id === 10) return true
      // Photo (8) — conditional on enableStudentPhoto
      if (s.id === 8) return flags.enableStudentPhoto
      // Documents (9) — always
      if (s.id === 9) return true
      return true
    })
  }, [data.className, flags])

  // Map visible steps to a sequential index for the stepper UI
  const stepIndex = visibleSteps.findIndex((s) => s.id === step)
  const currentVisibleIndex = stepIndex === -1 ? 0 : stepIndex

  // Stepper auto-scroll: keep current step centered in the horizontal nav
  useEffect(() => {
    const container = stepperScrollRef.current
    if (!container) return
    const currentBtn = container.querySelector(`[data-step-idx="${currentVisibleIndex}"]`) as HTMLElement | null
    if (currentBtn) {
      const scrollLeft = currentBtn.offsetLeft - container.offsetWidth / 2 + currentBtn.offsetWidth / 2
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' })
    }
  }, [currentVisibleIndex, step])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((prev) => {
      const nextData = { ...prev, [key]: value }

      // Auto-synchronize Permanent Address when sameAsCurrentAddress is enabled
      if (nextData.sameAsCurrentAddress) {
        if (key === 'currentAddress') nextData.permAddress = value as string
        if (key === 'country') nextData.permCountry = value as string
        if (key === 'state') nextData.permState = value as string
        if (key === 'district') nextData.permDistrict = value as string
        if (key === 'city') nextData.permCity = value as string
        if (key === 'pincode') nextData.permPincode = value as string
      }

      return nextData
    })
  }

  const handleToggleSameAddress = (checked: boolean) => {
    setData((prev) => {
      if (checked) {
        return {
          ...prev,
          sameAsCurrentAddress: true,
          permAddress: prev.currentAddress,
          permCountry: prev.country,
          permState: prev.state,
          permDistrict: prev.district,
          permCity: prev.city,
          permPincode: prev.pincode,
        }
      }
      return { ...prev, sameAsCurrentAddress: false }
    })
  }

  // Navigate through visible steps only (skips conditional steps automatically)
  const next = () => {
    const curIdx = visibleSteps.findIndex((s) => s.id === step)
    if (curIdx < visibleSteps.length - 1) {
      setStep(visibleSteps[curIdx + 1].id)
    }
  }
  const back = () => {
    const curIdx = visibleSteps.findIndex((s) => s.id === step)
    if (curIdx > 0) {
      setStep(visibleSteps[curIdx - 1].id)
    }
  }

  // Duplicate detection runs ONLY on final submit (not while filling)
  const [postSubmitDup, setPostSubmitDup] = useState<DuplicateMatch | null>(null)
  const [pendingSubmitData, setPendingSubmitData] = useState<{ formData: Partial<FormData>; feeState: Partial<FeeDataState> } | null>(null)

  // ─── Canonical draft persistence (spec §8) ────────────────────────────
  // The wizard state IS the application draft — it is persisted to the
  // admission store (and thus to tenant-scoped storage) on every change,
  // debounced 600ms. The photo, documents, and every field survive a
  // crash, a module switch, or a refresh. Final flush on unload.
  const draftIdRef = useRef<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const saveDraftNow = useCallback((silent: boolean) => {
    const current = dataRef.current
    if (!current.firstName && !current.lastName) return
    const id = draftIdRef.current || `DRAFT-${Date.now().toString().slice(-6)}`
    draftIdRef.current = id
    // getState() (not the reactive hook value): saving must never re-render
    // the wizard — a reactive dep here turns auto-save into an update loop.
    useAdmissionStore.getState().createOrUpdateDraft({ ...current }, current.feeState || {}, id, { silent })
  }, [])

  // Debounced auto-save while filling the form.
  useEffect(() => {
    if (viewMode !== 'form') return
    if (!data.firstName && !data.lastName) return
    const t = setTimeout(() => saveDraftNow(true), 600)
    return () => clearTimeout(t)
  }, [viewMode, data, saveDraftNow])

  // Immediate flush on tab hide / close / unmount — never lose the photo.
  useEffect(() => {
    if (viewMode !== 'form') return
    const flush = () => saveDraftNow(true)
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
     
  }, [viewMode, saveDraftNow])

  /** Begin a NEW blank application (resets draft identity). */
  const startNewApplication = useCallback(() => {
    draftIdRef.current = null
    setData(createBlankData())
    setStep(1)
    setViewMode('form')
  }, [])

  /** Load an existing application into the wizard (edit / resume / correct).
   *  Auto-saves target THE application itself — never a duplicate draft. */
  const loadApplicationIntoWizard = useCallback((appId: string, targetStep = 1) => {
    const appToEdit = useAdmissionStore.getState().applications.find((a) => a.id === appId)
    if (appToEdit) {
      draftIdRef.current = appId
      setData({ ...initialData, ...appToEdit.formData, feeState: appToEdit.formData.feeState || initialData.feeState })
    } else {
      draftIdRef.current = null
      setData(initialData)
    }
    setStep(targetStep)
    setViewMode('form')
  }, [])

  const finalizeSubmission = (formDataPartial: Partial<FormData>, feeDataPartial: Partial<FeeDataState>) => {
    const store = useAdmissionStore.getState()
    // If the wizard is editing an EXISTING application (resume / correction),
    // submit updates that record in place — never a duplicate. A fresh
    // auto-saved DRAFT copy is superseded by the real APP- record and removed.
    const editingId = draftIdRef.current
    const editingApp = editingId
      ? store.applications.find((a) => a.id === editingId)
      : undefined
    const isAutoDraft = !!editingApp && editingApp.status === 'Draft' && editingApp.id.startsWith('DRAFT-')

    let appId: string
    if (editingApp && !isAutoDraft) {
      appId = store.createOrUpdateDraft(formDataPartial, feeDataPartial, editingApp.id)
    } else {
      appId = store.createOrUpdateDraft(formDataPartial, feeDataPartial, `APP-${Date.now().toString().slice(-6)}`)
      if (isAutoDraft) store.deleteDraft(editingApp!.id)
    }
    store.submitApplication(appId)
    draftIdRef.current = null

    toast.success('Application submitted', {
      description: `${data.firstName} ${data.lastName}'s application is now in the review queue.`,
    })

    setPostSubmitDup(null)
    setPendingSubmitData(null)
    setData(createBlankData())
    setStep(1)
    setViewMode('list')
  }

  const handleSubmit = () => {
    const formDataPartial: Partial<FormData> = { ...data }
    const feeDataPartial: Partial<FeeDataState> = data.feeState || {}

    // Photo policy (spec §9/§14): when the school requires a photo, a missing
    // photo is surfaced clearly at submit — never a silent failure.
    const settings = useSchoolSettingsStore.getState().admissionSettings
    if (flags.enableStudentPhoto && settings.photoRequirement === 'required' && !data.photoDataUrl) {
      toast.error('Photo required', {
        description: 'Add a passport photo in the Photo step, or set the photo policy to Optional in Admissions Settings.',
      })
      setStep(8) // Photo step
      return
    }

    // Required-document policy (spec §3): a REQUIRED document that is
    // missing (not uploaded, not deferred) blocks submission. Deferred
    // ("Submit Later") is the explicit workflow escape hatch; OPTIONAL
    // documents never block.
    const requiredIssues = evaluateRequiredDocs(data.docStatuses)
    const missing = requiredIssues.filter((i) => i.kind === 'missing')
    if (missing.length > 0) {
      toast.error(`${missing.length} required ${missing.length === 1 ? 'document is' : 'documents are'} missing`, {
        description: `${missing.map((m) => m.doc.name).join(', ')} — upload them or choose "Submit Later" before submitting.`,
      })
      setStep(9) // Documents step
      return
    }
    const deferred = requiredIssues.filter((i) => i.kind === 'deferred')
    if (deferred.length > 0) {
      toast.info('Submitting with deferred required documents', {
        description: `${deferred.map((d) => d.doc.name).join(', ')} deferred by the admission desk — must be received before final enrollment.`,
      })
    }

    // Check duplicates only at submit time (never match the application against itself)
    if (dupConfig.enabled) {
      const match = checkDuplicates(data, dupConfig, students as any, admissionStore.applications || [], draftIdRef.current)
      if (match && match.matchType !== 'none') {
        setPostSubmitDup(match)
        setPendingSubmitData({ formData: formDataPartial, feeState: feeDataPartial })
        return
      }
    }
    finalizeSubmission(formDataPartial, feeDataPartial)
  }

  const handleContinueAnyway = () => {
    if (pendingSubmitData) {
      toast.success('Principal override logged', { description: 'Submission proceeding despite duplicate warning.' })
      finalizeSubmission(pendingSubmitData.formData, pendingSubmitData.feeState)
    }
  }

  const handleCancelSubmission = () => {
    setPostSubmitDup(null)
    setPendingSubmitData(null)
    toast.info('Submission cancelled')
  }

  /** Apply a scanned form's extracted fields (spec §28–§35).
   *  Always starts a FRESH application context — a scan is the start of a new
   *  application, never a merge into whatever draft was previously open
   *  (prevents data bleed between abandoned scans). Never auto-submits. */
  const applyScannedDraft = useCallback((extracted: Partial<FormData>, attachment: { fileName: string; date: string; confidence: number }) => {
    draftIdRef.current = null
    setData({
      ...createBlankData(),
      ...extracted,
      scannedAttachment: {
        fileName: attachment.fileName,
        date: attachment.date,
        confidence: attachment.confidence,
      },
    })
    setStep(1)
    setViewMode('form')
    toast.success('Application populated from scan', {
      description: 'Review each step, then submit when everything checks out — nothing is submitted automatically.',
    })
  }, [])

  return {
    flags,
    viewMode,
    setViewMode,
    step,
    setStep,
    data,
    setData,
    set,
    handleToggleSameAddress,
    next,
    back,
    visibleSteps,
    currentVisibleIndex,
    stepperScrollRef,
    postSubmitDup,
    handleSubmit,
    handleContinueAnyway,
    handleCancelSubmission,
    admissionStore,
    startNewApplication,
    loadApplicationIntoWizard,
    applyScannedDraft,
  }
}
