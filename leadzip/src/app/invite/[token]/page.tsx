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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md w-full p-8">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#0369A1]/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-[#0369A1]" />
          </div>
        </div>

        {invite.status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading invitation…</p>
          </div>
        )}

        {invite.status === 'error' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Invitation unavailable</p>
            </div>
            <p className="text-sm text-slate-500">{invite.message}</p>
            <a href="/dashboard" className="inline-block mt-2 text-sm text-[#0369A1] hover:underline">
              Go to Dashboard →
            </a>
          </div>
        )}

        {invite.status === 'accepted' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-semibold">You've joined the team!</p>
            </div>
            <p className="text-sm text-slate-500">Redirecting you to the dashboard…</p>
          </div>
        )}

        {invite.status === 'ready' && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-bold text-[#0F172A] mb-1">You're invited!</h1>
              <p className="text-sm text-slate-500">
                You've been invited to join{' '}
                <span className="font-semibold text-[#0F172A]">{invite.workspaceName}</span>{' '}
                on LeadZip.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Team</span>
                <span className="font-medium text-[#0F172A]">{invite.workspaceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invited email</span>
                <span className="font-medium text-[#0F172A]">{invite.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expires</span>
                <span className="text-slate-600">{new Date(invite.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>

            {authed === null ? null : authed ? (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-[#0369A1] hover:bg-[#0284c7] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
                {accepting ? 'Joining…' : 'Accept Invitation'}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 text-center">Sign in or create an account to accept this invitation.</p>
                <a
                  href={`/login?redirectTo=/invite/${token}`}
                  className="block w-full text-center bg-[#0369A1] hover:bg-[#0284c7] text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Sign In
                </a>
                <a
                  href={`/signup?redirectTo=/invite/${token}`}
                  className="block w-full text-center border border-slate-200 hover:bg-slate-50 text-[#0F172A] font-semibold py-3 rounded-xl transition-colors"
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
