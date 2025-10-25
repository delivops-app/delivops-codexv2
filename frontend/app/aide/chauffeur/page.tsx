import Link from 'next/link'

import { PageLayout } from '../../../components/PageLayout'

const faqs = [
  {
    question: 'Où récupérer ma première tournée ?',
    answer:
      'Depuis votre espace chauffeur, cliquez sur « Je récupère une tournée ». La liste des tournées disponibles s’affiche et vous pouvez en accepter une en un clic. Choisissez bien le/les bons types de colis.',
  },
  {
    question: 'Comment clôturer une tournée une fois terminée ?',
    answer:
      'Une fois la dernière étape validée, cliquez sur « Je clôture une tournée » pour confirmer la fin du parcours. Les informations sont immédiatement remontées à l’équipe.',
  },
]

export default function DriverHelpPage() {
  return (
    <PageLayout
      title="FAQ chauffeurs Delivops"
      description="Retrouvez les réponses aux questions les plus fréquentes pour démarrer vos tournées en toute sérénité."
      actions={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Retour à l&apos;accueil
        </Link>
      }
      contentClassName="max-w-3xl"
    >
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Consultez cette foire aux questions avant de prendre la route. Chaque réponse vous guide pas à pas dans l&apos;utilisation de l&apos;application mobile Delivops.
        </p>
        <div className="mt-4 space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-indigo-300 hover:bg-white"
            >
              <summary className="cursor-pointer text-base font-semibold text-slate-900">
                {faq.question}
              </summary>
              <p className="mt-2 text-sm text-slate-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
        <h2 className="text-base font-semibold">Besoin d&apos;aller plus loin ?</h2>
        <p className="mt-2">
          Pour toute question complémentaire, contactez votre administrateur Delivops ou consultez la documentation complète disponible dans l&apos;application mobile.
        </p>
      </section>
    </PageLayout>
  )
}
