import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnit } from "@/context/UnitContext";
import { useAtendentes } from "@/hooks/useAtendentes";

// Campo "Resp. atendimento". Com config.profissionaisFechados a pessoa escolhe
// numa lista fechada (cadastro de atendentes), sem digitar: texto livre gerava
// uma grafia nova por digitação ("Nice oliveira", "Nice Oliveira ", ...), que
// partia o relatório e deixava a IA achar a profissional livre. Sem a flag,
// segue o input com sugestões de sempre.
const NENHUM = "__nenhum__";

interface Props {
  value: string;
  onChange: (v: string) => void;
  listId: string;
  className?: string;
}

export function ProfissionalField({ value, onChange, listId, className }: Props) {
  const cfg = useUnit().config;
  const { data: atendentes } = useAtendentes();

  if (!cfg?.profissionaisFechados) {
    return (
      <Input list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nome..." className={className} />
    );
  }

  const nomes = (atendentes ?? []).map((a) => a.nome);
  // Valor antigo fora do cadastro continua visível (e selecionado) para não
  // apagar o dado ao abrir o modal; só não aparece como opção nova.
  const opcoes = value && !nomes.includes(value) ? [value, ...nomes] : nomes;

  return (
    <Select value={value || NENHUM} onValueChange={(v) => onChange(v === NENHUM ? "" : v)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Escolha o profissional" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NENHUM}>Sem profissional</SelectItem>
        {opcoes.map((n) => (
          <SelectItem key={n} value={n}>{n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
