import { ReactNode } from 'react'

interface PageLayoutProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  containerClassName?: string
  contentClassName?: string
  headerClassName?: string
}

function classNames(...values: (string | undefined | false)[]) {
  return values.filter(Boolean).join(' ')
}

export function PageLayout({
  title,
  description,
  actions,
  children,
  containerClassName,
  contentClassName,
  headerClassName,
}: PageLayoutProps) {
  return (
    <main
      className={classNames(
        'flex min-h-screen w-full flex-col items-stretch bg-slate-50 px-6 py-8 sm:px-12 sm:py-14 lg:px-16 lg:py-16',
        containerClassName,
      )}
    >
      <div
        className={classNames(
          'mx-auto w-full max-w-6xl space-y-6',
          contentClassName,
        )}
      >
        <header
          className={classNames(
            'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
            headerClassName,
          )}
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
            {description ? (
              <div className="mt-2 text-base text-slate-700">
                {typeof description === 'string' ? <p>{description}</p> : description}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  )
}
