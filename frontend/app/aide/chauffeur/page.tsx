import Link from 'next/link'

const faqs = [
  {
    question: 'Comment me connecter pour la première fois ?',
    answer:
      'Utilisez le bouton « Se connecter » sur la page d’accueil, puis saisissez les identifiants reçus dans votre email d’invitation. Vous serez automatiquement redirigé vers votre espace chauffeur.',
  },
  {
    question: 'Où récupérer ma première tournée ?',
    answer:
      'Depuis votre espace chauffeur, cliquez sur « Je récupère une tournée ». La liste des tournées disponibles s’affiche et vous pouvez en accepter une en un clic.',
  },
  {
    question: 'Comment suivre le déroulé des livraisons ?',
    answer:
      'Ouvrez la tournée acceptée pour voir chaque étape, les horaires prévus et les instructions spécifiques. Marquez les étapes comme effectuées au fur et à mesure pour garder le suivi à jour.',
  },
  {
    question: 'Que faire en cas d’imprévu pendant une tournée ?',
    answer:
      'Indiquez l’imprévu dans la note de l’étape concernée et prévenez votre contact opérationnel. Toutes les informations sont ainsi centralisées pour faciliter le suivi.',
  },
  {
    question: 'Comment clôturer une tournée une fois terminée ?',
    answer:
      'Une fois la dernière étape validée, cliquez sur « Je clôture une tournée » pour confirmer la fin du parcours. Les informations sont immédiatement remontées à l’équipe.',
  },
  {
    question: 'Puis-je revenir sur une tournée précédente ?',
    answer:
      'Oui, votre historique reste accessible depuis l’espace chauffeur. Consultez les tournées clôturées pour vérifier un détail ou confirmer une information.',
  },
]

export default function DriverHelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">FAQ chauffeurs Delivops</h1>
      <p>
        Cette foire aux questions répond aux interrogations les plus fréquentes lorsque vous démarrez sur Delivops. L’application est intuitive : référez-vous aux réponses ci-dessous pour lever vos doutes en quelques secondes.
      </p>
      <div className="space-y-4">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="rounded border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300"
          >
            <summary className="cursor-pointer text-lg font-semibold text-gray-900">
              {faq.question}
            </summary>
            <p className="mt-2 text-base text-gray-700">{faq.answer}</p>
          </details>
        ))}
      </div>
      <Link
        href="/"
        className="self-start rounded bg-blue-600 px-4 py-2 text-white"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
