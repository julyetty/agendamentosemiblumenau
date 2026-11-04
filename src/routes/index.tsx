import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { ExportarPdfMes } from "@/components/exportar-pdf-mes";
import { AUTH_STORAGE_KEY, TelaSenha, sairDaSessao } from "@/components/tela-senha";
import { supabase } from "@/integrations/supabase/client";
import { NOME_APP } from "@/lib/app-config";
import { TIPOS, TONE, asTipo, type Tipo } from "@/lib/atendimento";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: NOME_APP },
      {
        name: "description",
        content:
          "Registre atendimentos por data, horário e tipo, e gere automaticamente o cronograma diário de atividades.",
      },
      { property: "og:title", content: NOME_APP },
      {
        property: "og:description",
        content:
          "Registre atendimentos por data, horário e tipo, e gere o cronograma diário de atividades.",
      },
    ],
  }),
  component: Index,
});

type Visitante = { nome: string; parentesco: string };

type Agendamento = {
  id: string;
  data: string;
  horario: string;
  horarioFim: string;
  interno: string;
  tipo: Tipo;
  local: string;
  turma?: string | undefined;
  palestrante?: string | undefined;
  religiosos?: string[] | undefined;
  visitantes?: Visitante[] | undefined;
  observacao?: string | undefined;
  observacaoSaude?: string | undefined;
  observacaoManutencao?: string | undefined;
};

type AtendimentoRow = {
  id: number;
  tipo_atendimento: string;
  nome_interno: string | null;
  turma: string | null;
  nomes_religiosos: string[] | null;
  nome_palestrante: string | null;
  observacoes: string | null;
  observacao_saude: string | null;
  observacao_manutencao: string | null;
  local: string | null;
  data_atendimento: string | null;
  horario: string | null;
  horario_fim: string | null;
  visitantes: Visitante[] | null;
  created_at: string;
};

const INTERVALOS = [
  { horario: "09:30", fim: "09:45", periodo: "manhã" },
  { horario: "15:00", fim: "15:15", periodo: "tarde" },
];

const hoje = () => new Date().toISOString().slice(0, 10);

function dataLocal(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return new Date();
  return new Date(a, m - 1, d);
}

function ehFimDeSemana(iso: string) {
  const dia = dataLocal(iso).getDay();
  return dia === 0 || dia === 6;
}

function tituloDoDia(iso: string) {
  const dt = dataLocal(iso);
  const semana = dt.toLocaleDateString("pt-BR", { weekday: "long" });
  const mes = dt.toLocaleDateString("pt-BR", { month: "long" });
  const d = dt.getDate();
  return `${semana.charAt(0).toUpperCase() + semana.slice(1)}, ${d} de ${mes}`;
}

function nomesDosInternos(texto: string) {
  return texto
    .split(/[\n,;]+/)
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0);
}

function observacaoDoAgendamento(i: Agendamento) {
  const partes: string[] = [];
  if (i.tipo === "Escolarização" && i.turma) partes.push(i.turma);
  if (i.palestrante) partes.push(`Palestrante: ${i.palestrante}`);
  if (i.religiosos && i.religiosos.length > 0) {
    partes.push(`Religioso: ${i.religiosos.join(", ")}`);
  }
  if (i.visitantes && i.visitantes.length > 0) {
    partes.push(i.visitantes.map((v) => `${v.nome} · ${v.parentesco}`).join("\n"));
  }
  if (i.observacaoSaude) partes.push(i.observacaoSaude);
  if (i.observacaoManutencao) partes.push(`Manutenção: ${i.observacaoManutencao}`);
  if (i.observacao) partes.push(i.observacao);
  return partes.length > 0 ? partes.join("\n") : "—";
}

function textoInternos(internos: string[]) {
  const nomes = internos.filter((nome) => nome.trim() !== "");
  if (nomes.length > 1) return nomes.join("\n");
  return nomes[0] ?? "—";
}

function mensagemErro(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function rowToAgendamento(row: AtendimentoRow): Agendamento {
  return {
    id: String(row.id),
    data: row.data_atendimento ?? hoje(),
    horario: row.horario ?? "",
    horarioFim: row.horario_fim ?? "",
    interno: row.nome_interno ?? "",
    tipo: asTipo(row.tipo_atendimento),
    local: row.local ?? "",
    turma: row.turma ?? undefined,
    palestrante: row.nome_palestrante ?? undefined,
    religiosos: row.nomes_religiosos ?? undefined,
    visitantes: Array.isArray(row.visitantes) ? row.visitantes : undefined,
    observacao: row.observacoes ?? undefined,
    observacaoSaude: row.observacao_saude ?? undefined,
    observacaoManutencao: row.observacao_manutencao ?? undefined,
  };
}

const inputCls =
  "w-full rounded-[8px] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

function Index() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);

  useEffect(() => {
    const salvo = sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
    setAutenticado(salvo);
  }, []);

  if (autenticado === null) {
    return <div className="min-h-screen bg-surface" />;
  }

  if (!autenticado) {
    return <TelaSenha onAutenticado={() => setAutenticado(true)} />;
  }

  return <Cronograma onSair={() => setAutenticado(false)} />;
}

function Cronograma({ onSair }: { onSair: () => void }) {
  const [itens, setItens] = useState<Agendamento[]>([]);
  const [data, setData] = useState(hoje());
  const [horario, setHorario] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [interno, setInterno] = useState("");
  const [internos, setInternos] = useState<string[]>([]);
  const [tipo, setTipo] = useState<Tipo>("Psicológico");
  const [local, setLocal] = useState("");
  const [nomeEscola, setNomeEscola] = useState("");
  const [palestrante, setPalestrante] = useState("");
  const [religiosoNome, setReligiosoNome] = useState("");
  const [religiosos, setReligiosos] = useState<string[]>([]);
  const [visitanteNome, setVisitanteNome] = useState("");
  const [visitanteParentesco, setVisitanteParentesco] = useState("");
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [observacaoSaude, setObservacaoSaude] = useState("");
  const [observacaoManutencao, setObservacaoManutencao] = useState("");
  const [observacao, setObservacao] = useState("");

  const precisaObservacaoSaude = tipo === "Saúde";
  const precisaObservacaoManutencao = tipo === "Manutenção";
  const precisaPalestrante = tipo === "Palestra";
  const precisaReligioso = tipo === "Religioso";
  const precisaPessoa = tipo === "Videochamada" || tipo === "Visita presencial";
  const fimDeSemana = ehFimDeSemana(data);

  const carregarAtendimentos = async () => {
    try {
      const { data: rows, error } = await supabase
        .from("atendimentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setErro(error.message);
        toast.error(error.message);
        return;
      }
      setItens((rows ?? []).map((row) => rowToAgendamento(row as AtendimentoRow)));
    } catch (error) {
      const msg = mensagemErro(error, "Não foi possível carregar os atendimentos.");
      setErro(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    void carregarAtendimentos();
    const canal = supabase
      .channel("atendimentos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, () => {
        void carregarAtendimentos();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, []);

  const limpar = () => {
      setHorario("");
      setHorarioFim("");
      setInterno("");
      setInternos([]);
      setNomeEscola("");
      setPalestrante("");
      setReligiosoNome("");
      setReligiosos([]);
      setVisitanteNome("");
      setVisitanteParentesco("");
      setVisitantes([]);
      setObservacaoSaude("");
      setObservacaoManutencao("");
      setObservacao("");
      setErro("");
    };

  const adicionarVisitanteNaLista = () => {
    const nome = visitanteNome.trim();
    const parentesco = visitanteParentesco.trim();
    if (!nome || !parentesco) {
      setErro("Informe o nome e o parentesco da pessoa.");
      return;
    }
    setVisitantes((prev) => [...prev, { nome, parentesco }]);
    setVisitanteNome("");
    setVisitanteParentesco("");
    setErro("");
  };

  const removerVisitanteDaLista = (idx: number) =>
    setVisitantes((prev) => prev.filter((_, i) => i !== idx));

  const adicionarInternoNaLista = () => {
    const nome = interno.trim();
    if (!nome) return;
    if (internos.some((n) => n.toLowerCase() === nome.toLowerCase())) {
      setErro("Este interno já está na lista.");
      return;
    }
    setInternos((prev) => [...prev, nome]);
    setInterno("");
    setErro("");
  };

  const removerInternoDaLista = (nome: string) =>
    setInternos((prev) => prev.filter((n) => n !== nome));

  const listaReligiososAtual = () => {
    const digitado = religiosoNome.trim();
    if (!digitado) return religiosos;
    if (religiosos.some((n) => n.toLowerCase() === digitado.toLowerCase())) {
      return religiosos;
    }
    return [...religiosos, digitado];
  };

  const adicionarReligiosoNaLista = () => {
    const nome = religiosoNome.trim();
    if (!nome) return;
    if (religiosos.some((n) => n.toLowerCase() === nome.toLowerCase())) {
      setErro("Este nome já está na lista.");
      return;
    }
    setReligiosos((prev) => [...prev, nome]);
    setReligiosoNome("");
    setErro("");
  };

  const removerReligiosoDaLista = (nome: string) =>
    setReligiosos((prev) => prev.filter((n) => n !== nome));

  const adicionar = async () => {
      const escola = nomeEscola.trim();
      const nomes = interno.trim()
        ? [...internos, interno.trim()]
        : internos;
      if (!data || !horario || !horarioFim || nomes.length === 0) {
        setErro(
          "Preencha data, horário de início, horário de fim e adicione ao menos um interno.",
        );
        return;
      }
      if (horarioFim <= horario) {
        setErro("O horário de fim deve ser depois do horário de início.");
        return;
      }
      if (!local.trim()) {
        setErro("Informe o local do atendimento.");
        return;
      }
      if (tipo === "Escolarização" && !escola) {
        setErro("Informe o nome da escola / observação.");
        return;
      }
      const nomePalestrante = palestrante.trim();
      const listaReligiosos = precisaReligioso ? listaReligiososAtual() : [];
      const listaVisitantes =
        visitanteNome.trim() && visitanteParentesco.trim()
          ? [...visitantes, { nome: visitanteNome.trim(), parentesco: visitanteParentesco.trim() }]
          : visitantes;
      if (precisaPessoa && listaVisitantes.length === 0) {
        setErro("Informe o nome e o parentesco de ao menos uma pessoa.");
        return;
      }
  
      const registros = nomes.map((nome) => {
        const item: Agendamento = {
          id: "",
          data,
          horario,
          horarioFim,
          interno: nome,
          tipo,
          local: local.trim(),
          turma: tipo === "Escolarização" ? escola : undefined,
          palestrante: precisaPalestrante && nomePalestrante ? nomePalestrante : undefined,
          religiosos: precisaReligioso && listaReligiosos.length > 0 ? listaReligiosos : undefined,
          visitantes: precisaPessoa ? listaVisitantes : undefined,
          observacao: observacao.trim() || undefined,
          observacaoSaude: precisaObservacaoSaude && observacaoSaude.trim() ? observacaoSaude.trim() : undefined,
          observacaoManutencao:
            precisaObservacaoManutencao && observacaoManutencao.trim() ? observacaoManutencao.trim() : undefined,
        };
        const observacaoTexto = observacaoDoAgendamento(item);
        return {
          tipo_atendimento: tipo,
          nome_interno: nome,
          turma: tipo === "Escolarização" ? escola : null,
          nomes_religiosos: precisaReligioso && listaReligiosos.length > 0 ? listaReligiosos : null,
          nome_palestrante: precisaPalestrante && nomePalestrante ? nomePalestrante : null,
          observacoes: observacaoTexto === "—" ? null : observacaoTexto,
          observacao_saude: item.observacaoSaude ?? null,
          observacao_manutencao: item.observacaoManutencao ?? null,
          local: local.trim(),
          data_atendimento: data,
          horario,
          horario_fim: horarioFim,
          visitantes: precisaPessoa ? listaVisitantes : null,
        };
      });

    try {
      const { error } = await supabase.from("atendimentos").insert(registros);
      if (error) {
        setErro(error.message);
        toast.error(error.message);
        return;
      }
      toast.success("Atendimento salvo no cronograma.");
      limpar();
      await carregarAtendimentos();
    } catch (error) {
      const msg = mensagemErro(error, "Não foi possível salvar o atendimento.");
      setErro(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  const excluirGrupo = async (ids: string[]) => {
    setExcluindoId(ids[0] ?? null);
    try {
      const { error } = await supabase
        .from("atendimentos")
        .delete()
        .in(
          "id",
          ids.map((id) => Number(id)),
        );
      if (error) {
        setErro(error.message);
        toast.error(error.message);
        return;
      }
      toast.success("Atendimento removido.");
      await carregarAtendimentos();
    } catch (error) {
      const msg = mensagemErro(error, "Não foi possível excluir o atendimento.");
      setErro(msg);
      toast.error(msg);
    } finally {
      setExcluindoId(null);
    }
  };

  const doDia = useMemo(
    () =>
      itens
        .filter((i) => i.data === data)
        .sort((a, b) => a.horario.localeCompare(b.horario)),
    [itens, data],
  );

  type Grupo = {
    ids: string[];
    horario: string;
    horarioFim: string;
    tipo: Tipo;
    local: string;
    turma?: string | undefined;
    internos: string[];
    complemento: string;
  };

  type Linha =
    | { kind: "grupo"; grupo: Grupo }
    | { kind: "intervalo"; horario: string; fim: string; periodo: string }
    | { kind: "turno" };

  const linhas: Linha[] = useMemo(() => {
    const grupos: Grupo[] = [];
    for (const i of doDia) {
      const comp = observacaoDoAgendamento(i);
      const alvo = grupos.find(
        (g) =>
          g.tipo === i.tipo &&
          g.horario === i.horario &&
          g.horarioFim === i.horarioFim &&
          g.local === i.local &&
          (i.tipo !== "Escolarização" || g.turma === i.turma),
      );
      if (alvo) {
        alvo.ids.push(i.id);
        alvo.internos.push(i.interno);
        if (alvo.complemento === "—") alvo.complemento = comp;
        continue;
      }
      grupos.push({
        ids: [i.id],
        horario: i.horario,
        horarioFim: i.horarioFim,
        tipo: i.tipo,
        local: i.local,
        turma: i.turma,
        internos: [i.interno],
        complemento: comp,
      });
    }
    const base: Linha[] = grupos.map((grupo) => ({ kind: "grupo", grupo }));
    const pausas: Linha[] = ehFimDeSemana(data)
      ? []
      : INTERVALOS.map((i) => ({ kind: "intervalo", ...i }));
    const horaDe = (l: Linha) =>
      l.kind === "grupo" ? l.grupo.horario : l.kind === "intervalo" ? l.horario : "13:00";
    const ordenadas = [...base, ...pausas].sort((a, b) =>
      horaDe(a).localeCompare(horaDe(b)),
    );
    const idxTarde = ordenadas.findIndex((l) => horaDe(l) >= "13:00");
    if (idxTarde > 0) {
      ordenadas.splice(idxTarde, 0, { kind: "turno" });
    }
    return ordenadas;
  }, [doDia, data]);

  const gerarPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", format: "a4" });
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text(NOME_APP, 14, 14);
    doc.setFontSize(12);
    doc.text(`Cronograma de Atendimento Diário — ${tituloDoDia(data)}`, 14, 22);
    if (!fimDeSemana) {
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text("Intervalos de escolarização: 09:30 – 09:45 (manhã) e 15:00 – 15:15 (tarde)", 14, 28);
    }

    const zebraPar: [number, number, number] = [255, 255, 255];
    const zebraImpar: [number, number, number] = [243, 244, 246];
    const bordaSuave: [number, number, number] = [209, 213, 219];
    const textoEscuro: [number, number, number] = [17, 24, 39];

    autoTable(doc, {
      startY: fimDeSemana ? 28 : 33,
      margin: { left: 14, right: 14 },
      head: [["Horário", "Atendimento", "Interno", "Local", "OBSERVAÇÃO"]],
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 32 },
        2: { cellWidth: 52 },
        3: { cellWidth: 30 },
        4: { cellWidth: 54 },
      },
      body: linhas.map((l) =>
        l.kind === "turno"
          ? ["", "", "", "", ""]
          : l.kind === "intervalo"
            ? [`${l.horario} – ${l.fim}`, "Intervalo Escolarização", "—", "—", ""]
            : [
                `${l.grupo.horario} – ${l.grupo.horarioFim}`,
                l.grupo.tipo,
                textoInternos(l.grupo.internos),
                l.grupo.local,
                l.grupo.complemento === "—" ? "—" : l.grupo.complemento,
              ],
      ),
      theme: "grid",
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        halign: "left",
        valign: "middle",
        cellPadding: 3,
        lineColor: bordaSuave,
        lineWidth: 0.2,
      },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: textoEscuro,
        valign: "middle",
        lineColor: bordaSuave,
        lineWidth: 0.2,
        fillColor: zebraPar,
      },
      alternateRowStyles: {
        fillColor: zebraImpar,
        textColor: textoEscuro,
      },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") return;
        const fundo = hookData.row.index % 2 === 0 ? zebraPar : zebraImpar;
        hookData.cell.styles.fillColor = fundo;
        hookData.cell.styles.textColor = textoEscuro;
        const l = linhas[hookData.row.index];
        if (l?.kind === "turno") {
          hookData.cell.styles.minCellHeight = 6;
        }
        if (l?.kind === "grupo" && l.grupo.complemento) {
          const texto = l.grupo.complemento.toString();
          const linhasTexto = texto.split("\\n").length;
          const alturaMinima = linhasTexto * 12 + 6;
          if (hookData.cell.styles.minCellHeight < alturaMinima) {
            hookData.cell.styles.minCellHeight = alturaMinima;
          }
        }
      },
    });

    doc.save(`cronograma-${data}.pdf`);
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-ink text-base antialiased">
      <header className="bg-ink text-surface">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-[10px] bg-accent ring-1 ring-white/10">
              <span className="text-sm font-semibold tracking-tight">AS</span>
            </div>
            <div className="leading-tight">
              <p className="text-base font-semibold tracking-tight">{NOME_APP}</p>
              <p className="text-xs text-surface/60">Unidade Socioeducativa · Setor de Atendimento</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/5 px-3 py-1 text-xs text-surface/70 sm:inline">
              Operacional
            </span>
            <span className="hidden text-xs text-surface/50 sm:inline">Turno único · Acesso restrito</span>
            <button
              type="button"
              onClick={() => {
                sairDaSessao();
                onSair();
              }}
              className="rounded-[8px] bg-white/10 px-3 py-1.5 text-xs font-semibold text-surface ring-1 ring-white/15 hover:bg-white/15"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="inline-flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span>Cronograma de Atendimento Diário</span>
            <span className="text-base font-normal text-ink/55 sm:text-lg">
              - Registre os atendimentos do dia e acompanhe o cronograma
            </span>
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-[12px] bg-panel ring-1 ring-black/5 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold tracking-tight">Novo agendamento</h2>
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink">Etapa 1</span>
            </div>

            <div className="space-y-4 px-5 py-5 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(12.5rem,1.5fr)_1fr_1fr]">
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-ink">Data</span>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className={`${inputCls} min-w-[12.5rem]`}
                    style={{ colorScheme: "light" }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink">Início</span>
                  <input
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className={inputCls}
                    style={{ colorScheme: "light" }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink">Fim</span>
                  <input
                    type="time"
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className={inputCls}
                    style={{ colorScheme: "light" }}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink">Tipo de atendimento</span>
                <select
                  value={tipo}
                  onChange={(e) => {
                    const novo = e.target.value as Tipo;
                    setTipo(novo);
                    if (novo !== "Religioso") {
                      setReligiosoNome("");
                      setReligiosos([]);
                    }
                    if (novo !== "Palestra") {
                      setPalestrante("");
                    }
                    if (novo !== "Escolarização") {
                      setNomeEscola("");
                    } else {
                      setInternos([]);
                    }
                  }}
                  className={inputCls}
                >
                  {TIPOS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>

              <div className="block">
                <span className="mb-1 block text-xs font-medium text-ink">Nome do interno</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={interno}
                    onChange={(e) => setInterno(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarInternoNaLista();
                      }
                    }}
                    placeholder="Nome do interno"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={adicionarInternoNaLista}
                    className="shrink-0 rounded-[8px] bg-accent-soft px-3 py-2 text-xs font-semibold text-pure ring-1 ring-accent transition-transform active:scale-[0.97]"
                  >
                    + Interno
                  </button>
                </div>
                {internos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {internos.map((nome) => (
                      <span
                        key={nome}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-pure ring-1 ring-accent/20"
                      >
                        {nome}
                        <button
                          type="button"
                          onClick={() => removerInternoDaLista(nome)}
                          aria-label={`Remover ${nome}`}
                          className="grid size-4 place-items-center rounded-full text-pure/70 hover:bg-black/10 hover:text-pure"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-ink">
                  Adicione quantos internos participarem da mesma atividade.
                </p>
              </div>

              {precisaReligioso && (
                <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    Dados do atendimento religioso
                  </p>
                  <div className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">Nome do Religioso</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={religiosoNome}
                        onChange={(e) => setReligiosoNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            adicionarReligiosoNaLista();
                          }
                        }}
                        placeholder="Nome do religioso ou responsável"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={adicionarReligiosoNaLista}
                        className="shrink-0 rounded-[8px] bg-accent-soft px-3 py-2 text-xs font-semibold text-pure ring-1 ring-accent transition-transform active:scale-[0.97]"
                      >
                        + Nome
                      </button>
                    </div>
                    {religiosos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {religiosos.map((nome) => (
                          <span
                            key={nome}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-pure ring-1 ring-accent/20"
                          >
                            {nome}
                            <button
                              type="button"
                              onClick={() => removerReligiosoDaLista(nome)}
                              aria-label={`Remover ${nome}`}
                              className="grid size-4 place-items-center rounded-full text-pure/70 hover:bg-black/10 hover:text-pure"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-ink">
                      Adicione um ou mais nomes, ou o responsável pelo atendimento.
                    </p>
                  </div>
                </div>
              )}

              {precisaPalestrante && (
                <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    Dados da palestra
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">Nome do Palestrante</span>
                    <input
                      type="text"
                      value={palestrante}
                      onChange={(e) => setPalestrante(e.target.value)}
                      placeholder="Nome do palestrante"
                      className={inputCls}
                    />
                  </label>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink">Local</span>
                <input
                  type="text"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Digite o local do atendimento"
                  className={inputCls}
                />
              </label>

              <div className="block">
                <span className="mb-1 block text-xs font-medium text-ink">Observação</span>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Digite observações adicionais sobre esta atividade (opcional)..."
                  className={inputCls}
                />
              </div>

              {precisaObservacaoSaude && (
                <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    Dados do atendimento de saúde
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">
                      Descrição do Atendimento de Saúde / O que será realizado:
                    </span>
                    <textarea
                      value={observacaoSaude}
                      onChange={(e) => setObservacaoSaude(e.target.value)}
                      className={inputCls}
                      rows={3}
                      placeholder="Descreva o que será feito no atendimento de saúde"
                    />
                  </label>
                </div>
              )}

              {precisaObservacaoManutencao && (
                <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    Dados da manutenção
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">
                      Nome do interno responsável / envolvido na manutenção
                    </span>
                    <input
                      type="text"
                      value={interno}
                      onChange={(e) => setInterno(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          adicionarInternoNaLista();
                        }
                      }}
                      placeholder="Nome do interno responsável"
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">
                      Descrição da Manutenção / O que será realizado:
                    </span>
                    <textarea
                      value={observacaoManutencao}
                      onChange={(e) => setObservacaoManutencao(e.target.value)}
                      className={inputCls}
                      rows={3}
                      placeholder="Descreva o que será realizado na manutenção"
                    />
                  </label>
                </div>
              )}

              {tipo === "Escolarização" && (
                <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    Dados da escolarização
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">Nome da Escola / Observação:</span>
                    <textarea
                      value={nomeEscola}
                      onChange={(e) => setNomeEscola(e.target.value)}
                      rows={2}
                      required
                      placeholder="Informe a instituição de ensino responsável"
                      className={inputCls}
                    />
                  </label>
                </div>
              )}

              {precisaPessoa && (
                <div className="space-y-3 rounded-[10px] bg-accent-soft/60 p-3 ring-1 ring-accent/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {tipo === "Videochamada" ? "Dados da videochamada" : "Dados da visita presencial"}
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">Nome da pessoa</span>
                    <input
                      type="text"
                      value={visitanteNome}
                      onChange={(e) => setVisitanteNome(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink">Parentesco</span>
                    <input
                      type="text"
                      value={visitanteParentesco}
                      onChange={(e) => setVisitanteParentesco(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          adicionarVisitanteNaLista();
                        }
                      }}
                      className={inputCls}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={adicionarVisitanteNaLista}
                    className="rounded-[8px] bg-accent-soft px-3 py-2 text-xs font-semibold text-pure ring-1 ring-accent transition-transform active:scale-[0.97]"
                  >
                    + Pessoa
                  </button>
                  {visitantes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {visitantes.map((v, idx) => (
                        <span
                          key={`${v.nome}-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-pure ring-1 ring-accent/20"
                        >
                          {v.nome} · {v.parentesco}
                          <button
                            type="button"
                            onClick={() => removerVisitanteDaLista(idx)}
                            aria-label={`Remover ${v.nome}`}
                            className="grid size-4 place-items-center rounded-full text-pure/70 hover:bg-black/10 hover:text-pure"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-ink">Adicione quantas pessoas participarem da mesma atividade.</p>
                </div>
              )}

              {erro && <p className="text-xs font-medium text-clay">{erro}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => void adicionar()}
                  disabled={salvando}
                  className="rounded-[8px] bg-ink px-4 py-2 text-sm font-medium text-surface ring-1 ring-ink transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {salvando ? "Salvando..." : "Adicionar ao cronograma"}
                </button>
                <button
                  onClick={limpar}
                  className="rounded-[8px] px-3 py-2 text-sm font-medium text-ink hover:text-ink"
                >
                  Limpar
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[12px] bg-panel ring-1 ring-black/5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink">Cronograma do dia</p>
                <h2 className="text-lg font-semibold tracking-tight">{tituloDoDia(data)}</h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-ink">
                  {doDia.length} {doDia.length === 1 ? "atendimento" : "atendimentos"}
                </span>
                <button
                  type="button"
                  onClick={gerarPdf}
                  className="rounded-[8px] bg-ink px-3 py-1.5 text-xs font-semibold text-surface ring-1 ring-ink transition-transform active:scale-[0.97]"
                >
                  Gerar PDF
                </button>
                <ExportarPdfMes dataReferencia={data} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-pure">
                    <th className="px-5 py-2.5 font-semibold">Horário</th>
                    <th className="px-3 py-2.5 font-semibold">Atendimento</th>
                    <th className="px-3 py-2.5 font-semibold">Interno</th>
                    <th className="px-3 py-2.5 font-semibold">Local</th>
                    <th className="px-5 py-2.5 font-semibold">OBSERVAÇÃO</th>
                    <th className="px-3 py-2.5 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-pure">
                  {linhas.map((l) =>
                    l.kind === "turno" ? (
                      <tr key="sep-turno-tarde">
                        <td colSpan={6} className="bg-surface px-5 py-2.5">
                          <div className="border-t-2 border-ink/60" />
                        </td>
                      </tr>
                    ) : l.kind === "intervalo" ? (
                      <tr
                        key={`int-${l.horario}`}
                        className="border-b border-line/70 bg-act-intervalo/60"
                      >
                        <td className="px-5 py-3 font-medium tabular-nums text-pure">
                          {l.horario} – {l.fim}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-act-intervalo px-2.5 py-1 text-xs font-medium text-pure">
                            Intervalo Escolarização
                          </span>
                        </td>
                        <td className="px-3 py-3 text-pure">—</td>
                        <td className="px-3 py-3 text-pure">—</td>
                        <td className="px-5 py-3 text-pure">—</td>
                        <td className="px-3 py-3 text-pure">—</td>
                      </tr>
                    ) : (
                      <tr key={l.grupo.ids.join("-")} className="border-b border-line/70">
                        <td className="px-5 py-3 font-medium tabular-nums text-pure">
                          {l.grupo.horario} – {l.grupo.horarioFim}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium text-pure ${TONE[l.grupo.tipo]}`}
                          >
                            {l.grupo.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-pure">
                          <span className="whitespace-pre-line">{textoInternos(l.grupo.internos)}</span>
                        </td>
                        <td className="px-3 py-3 text-pure">{l.grupo.local}</td>
                        <td className="px-5 py-3 text-pure">
                          <span className="whitespace-pre-line">{l.grupo.complemento}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => void excluirGrupo(l.grupo.ids)}
                            disabled={excluindoId === l.grupo.ids[0]}
                            className="rounded-[8px] px-2 py-1 text-xs font-semibold text-clay ring-1 ring-clay/30 hover:bg-clay-soft disabled:opacity-60"
                          >
                            {excluindoId === l.grupo.ids[0] ? "Excluindo..." : "Excluir"}
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
