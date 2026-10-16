import { redirect } from 'next/navigation'

/* Probniylar Lidlarga qo'shildi (16.10): eski havolalar "Bugun sinov" filtriga boradi */
export default function Probniylar() {
  redirect('/crm/lidlar?tez=sinov')
}
