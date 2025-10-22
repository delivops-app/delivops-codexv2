import Link from 'next/link'

const steps = [
  {
    title: 'Inviter un chauffeur',
    description:
      "Depuis le tableau de bord, cliquez sur « Inviter un chauffeur » pour remplir le formulaire et envoyer une invitation par email. C’est grâce à ce lien unique que le chauffeur pourra créer son compte, se connecter et commencer à déclarer ses tournées.",
  },
  {
    title: 'Suivre l’activité des chauffeurs',
    description:
      "Accédez à « Liste des chauffeurs » pour visualiser en un coup d’œil leur statut, leurs tournées en cours et les informations clés dont vous avez besoin pour réagir rapidement.",
  },
  {
    title: 'Piloter les tournées avec la synthèse',
    description:
      "Ouvrez « Synthèse des tournées » pour analyser les livraisons clôturées, identifier les retards et repérer les points d’amélioration. Cette vue regroupe les indicateurs essentiels pour piloter votre activité.",
  },
  {
    title: 'Gérer vos clients facilement',
    description:
      "Utilisez le gestionnaire de clients pour ajouter de nouveaux comptes, mettre à jour les coordonnées existantes ou suspendre un accès en quelques clics. Vous gardez ainsi le contrôle complet de votre portefeuille clients.",
  },
]

export default function AdminHelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Guide administrateur Delivops</h1>
      <p>
        Découvrez, étape par étape, comment prendre en main Delivops et activer les
        leviers essentiels pour orchestrer vos opérations de livraison en toute
        confiance.
      </p>
      <ol className="list-decimal space-y-4 pl-6">
        {steps.map((step) => (
          <li key={step.title}>
            <h2 className="text-xl font-semibold">{step.title}</h2>
            <p className="text-justify text-base text-gray-700">{step.description}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/"
        className="self-start rounded bg-blue-600 px-4 py-2 text-white"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
