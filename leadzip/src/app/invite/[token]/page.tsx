'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type InviteState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; email: string; workspaceName: string; expiresAt: string }
  | { status: 'accepted' }

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [invite, setInvite] = useState<InviteState>({ status: 'loading' })
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setInvite({ status: 'error', message: data.error })
        } else {
          setInvite({
            status: 'ready',
            email: data.email,
            workspaceName: data.workspace?.name ?? 'a team',
            expiresAt: data.expiresAt,
          })
        }
      })
      .catch(() => setInvite({ status: 'error', message: 'Failed to load invitation' }))
  }, [token])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))
  }, [])

  const handleAccept = async () => {
    setAccepting(true)
    const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok && data.ok) {
      setInvite({ status: 'accepted' })
      setTimeout(() => router.push('/dashboard'), 2000)
    } else {
      setInvite({ status: 'error', message: data.error ?? 'Failed to accept invitation' })
    }
    setAccepting(false)
  }

  return (
    <div className="grain relative min-h-screen bg-paper flex items-center justify-center px-4 text-ink">
      <div className="bg-white border border-sand rounded-2xl shadow-card card-lift max-w-md w-full p-8">
        <div className="flex justify-center mb-6">
          <div className="relative w-14 h-14 rounded-2xl bg-signal/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-signal" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-lime ring-2 ring-white" />
          </div>
        </div>

        {invite.status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-stone">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading invitation…</p>
          </div>
        )}

        {invite.status === 'error' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-signal-600">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Invitation unavailable</p>
            </div>
            <p className="text-sm text-stone">{invite.message}</p>
            <a href="/dashboard" className="inline-block mt-2 text-sm font-medium text-signal hover:underline">
              Go to Dashboard →
            </a>
          </div>
        )}

        {invite.status === 'accepted' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-forest">
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-semibold">You&apos;ve joined the team!</p>
            </div>
            <p className="text-sm text-stone">Redirecting you to the dashboard…</p>
          </div>
        )}

        {invite.status === 'ready' && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="font-display text-xl font-extrabold text-ink mb-1">You&apos;re invited!</h1>
              <p className="text-sm text-stone">
                You&apos;ve been invited to join{' '}
                <span className="font-semibold text-ink">{invite.workspaceName}</span>{' '}
                on LeadZipp.
              </p>
            </div>

            <div className="bg-paper-2 border border-sand rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-stone">Team</span>
                <span className="font-medium text-ink">{invite.workspaceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">Invited email</span>
                <span className="font-medium text-ink">{invite.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">Expires</span>
                <span className="text-ink-soft">{new Date(invite.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>

            {authed === null ? null : authed ? (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-signal hover:bg-signal-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
                {accepting ? 'Joining…' : 'Accept Invitation'}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-stone text-center">Sign in or create an account to accept this invitation.</p>
                <a
                  href={`/login?redirectTo=/invite/${token}`}
                  className="block w-full text-center bg-signal hover:bg-signal-600 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Sign In
                </a>
                <a
                  href={`/signup?redirectTo=/invite/${token}`}
                  className="block w-full text-center border border-sand hover:bg-paper-2 text-ink font-semibold py-3 rounded-xl transition-colors"
                >
                  Create Account
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
