import Link from 'next/link'

const faqs = [
  {
    question: 'Comment aider un chauffeur à se connecter pour la première fois ?',
    answer:
      "Invitez d’abord le chauffeur depuis votre tableau de bord en cliquant sur « Inviter un chauffeur », puis renseignez son nom et son adresse email avant d’envoyer l’invitation. Il reçoit ainsi un lien unique lui permettant de créer son mot de passe et d’accéder à l’application. Assurez-vous qu’il utilise ce lien pour sa première connexion et qu’il valide bien son adresse email : dès que c’est fait, il peut rejoindre son espace chauffeur et récupérer ses tournées.",
  },
]

export default function AdminHelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">FAQ administrateur Delivops</h1>
      <p>
        Cette foire aux questions se concentre sur la première connexion des chauffeurs
        afin de vous guider pas à pas lors de leur onboarding.
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
