'use client'

import { KeyRound, Copy, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/ui'
import type { IssuanceArtifacts } from './letter-data'

interface CredentialsTabProps {
  artifacts: IssuanceArtifacts
  onCopy: () => void
}

/**
 * Credential sheet — the SECURE, SEPARATE channel for portal onboarding
 * (spec §23). Never part of the official admission letter.
 */
export function CredentialsTab({ artifacts, onCopy }: CredentialsTabProps) {
  const { loginId, tempPassword } = artifacts
  const ready = loginId !== '—'

  return (
    <GlassCard className="p-6 max-w-lg mx-auto space-y-4 border text-center">
      <KeyRound className="h-10 w-10 text-emerald-600 mx-auto" />
      <div>
        <h3 className="font-bold text-lg">Student Portal Credentials</h3>
        <p className="text-xs text-muted-foreground">
          Issued once at enrollment — hand to the parent securely, separate from the admission letter.
        </p>
      </div>

      {ready ? (
        <>
          <div className="p-4 rounded-xl bg-muted/50 text-left space-y-3 border text-xs font-mono">
            <div>
              <span className="text-muted-foreground text-[10px] block font-sans">PORTAL</span>
              <span className="font-bold text-emerald-600">Scholario Student Portal — school web address</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block font-sans">LOGIN ID / USERNAME</span>
              <span className="font-extrabold text-sm text-foreground">{loginId}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block font-sans">TEMPORARY PASSWORD</span>
              <span className="font-extrabold text-sm text-foreground">{tempPassword}</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Ask the parent to sign in and change this password immediately.
          </p>

          <Button size="sm" onClick={onCopy} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 w-full">
            <Copy className="h-3.5 w-3.5" />
            Copy Login Credentials
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Credentials are generated when the admission is completed and enrolled.
        </p>
      )}
    </GlassCard>
  )
}
