import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'
import { AddGuestForm } from '@/components/admin/add-guest-form'
import { BulkUploadGuestsForm } from '@/components/admin/bulk-upload-guests-form'
import { EditableGuestName } from '@/components/admin/editable-guest-name'

export const dynamic = 'force-dynamic'

type GuestRow = {
  id: string
  email: string
  full_name: string | null
  is_blocked: boolean
  is_admin: boolean
  invited_at: string
  link_sent_at: string | null
  first_visit_at: string | null
  last_visit_at: string | null
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function fmt(d: string | null): string {
  if (!d) return '—'
  return dateFmt.format(new Date(d))
}

export default async function AdminGuestsPage() {
  await requireAdmin()
  const service = getServiceClient()

  const { data: guestsRaw } = await service
    .from('guests')
    .select(
      'id, email, full_name, is_blocked, is_admin, invited_at, link_sent_at, first_visit_at, last_visit_at',
    )
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .order('invited_at', { ascending: false })

  const guests = (guestsRaw ?? []) as GuestRow[]
  const loggedInCount = guests.filter((g) => g.first_visit_at !== null).length

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/admin" label="admin" />
        <BAPageTitle
          eyebrow="admin · invités"
          title="Qui est complice."
          italicWord="complice"
          sub={`${guests.length} invités au total — ${loggedInCount} se sont déjà connectés au moins une fois. Clique sur un nom pour le corriger.`}
        />

        <div className="px-[22px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.6fr_1fr] lg:items-start">
          {/* Tableau */}
          <BACard className="p-[16px] overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-ink-mute font-mono uppercase tracking-[0.1em] text-[10px]">
                  <th className="pb-[10px] pr-[10px]">Invité</th>
                  <th className="pb-[10px] pr-[10px]">Lien envoyé</th>
                  <th className="pb-[10px] pr-[10px]">1ère visite</th>
                  <th className="pb-[10px] pr-[10px]">Dernière</th>
                  <th className="pb-[10px]">État</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-t border-paper-edge align-top">
                    <td className="py-[10px] pr-[10px]">
                      <EditableGuestName
                        guestId={g.id}
                        initialName={g.full_name}
                        email={g.email}
                      />
                    </td>
                    <td className="py-[10px] pr-[10px] text-ink-soft">{fmt(g.link_sent_at)}</td>
                    <td className="py-[10px] pr-[10px] text-ink-soft">{fmt(g.first_visit_at)}</td>
                    <td className="py-[10px] pr-[10px] text-ink-soft">{fmt(g.last_visit_at)}</td>
                    <td className="py-[10px]">
                      <div className="flex flex-col gap-[2px]">
                        {g.is_admin && <Badge color="ink">admin</Badge>}
                        {g.is_blocked && <Badge color="stamp">bloqué</Badge>}
                        {!g.is_admin && !g.is_blocked && g.first_visit_at && (
                          <Badge color="olive">actif</Badge>
                        )}
                        {!g.is_admin && !g.is_blocked && !g.first_visit_at && (
                          <Badge color="mute">en attente</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {guests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-[20px] text-center text-ink-mute">
                      Aucun invité — utilise le formulaire à droite.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </BACard>

          {/* Add form + bulk import */}
          <div className="lg:sticky lg:top-[20px] flex flex-col gap-[18px]">
            <AddGuestForm />
            <BulkUploadGuestsForm />
          </div>
        </div>

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}

type BadgeColor = 'ink' | 'stamp' | 'olive' | 'mute'

const badgePalette: Record<BadgeColor, string> = {
  ink: 'bg-ink text-paper',
  stamp: 'bg-stamp text-paper',
  olive: 'bg-olive text-paper',
  mute: 'bg-paper-edge text-ink-mute',
}

function Badge({ children, color }: { children: React.ReactNode; color: BadgeColor }) {
  return (
    <span
      className={`inline-block rounded-[4px] px-[6px] py-[2px] font-mono uppercase tracking-[0.1em] text-[10px] w-fit ${badgePalette[color]}`}
    >
      {children}
    </span>
  )
}
