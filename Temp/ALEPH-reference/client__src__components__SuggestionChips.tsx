import { DocumentacionIcon, EstudioIcon, InvestigacionProfundaIcon, HojasIcon } from '@/components/LottieIcons';

interface SuggestionChipsProps {
  onSelect: (tool: 'research' | 'slides' | 'agents' | 'study') => void;
}

export default function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  const suggestions = [
    { label: 'Investigar un tema', Icon: InvestigacionProfundaIcon, tool: 'research' as const },
    { label: 'Crear diapositivas', Icon: HojasIcon, tool: 'slides' as const },
    { label: 'Analizar documento', Icon: EstudioIcon, tool: 'study' as const },
    { label: 'Generar código', Icon: DocumentacionIcon, tool: 'agents' as const },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {suggestions.map(({ label, Icon, tool }, i) => (
        <button
          key={tool}
          onClick={() => onSelect(tool)}
          className="chip-glass flex items-center gap-2 px-4 py-2 text-[12.5px] text-paper-dim rounded-full hover:text-paper font-medium msg-enter"
          style={{ animationDelay: `${320 + i * 70}ms` }}
        >
          <Icon size={22} strokeWidth={1.8} className="shrink-0" style={{ color: 'var(--accent-bright)' }} />
          <span className="text-paper">{label}</span>
        </button>
      ))}
    </div>
  );
}
