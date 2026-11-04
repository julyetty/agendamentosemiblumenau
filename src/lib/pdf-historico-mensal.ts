import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NOME_APP } from "@/lib/app-config";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

type Visitante = { nome: string; parentesco: string };

type AtendimentoRow = {
  id: number;
  tipo_atendimento: string;
  nome_interno: string | null;
  local: string | null;
  observacao: string | null;
  data_atendimento: string | null;
  horario: string | null;
  horario_fim: string | null;
  created_at: string;
};

type AtendimentoMes = {
  id: string;
  data: string;
  horario: string;
  horarioFim: string;
  interno: string;
  tipo: string;
  local: string;
  observacao?: string | undefined;
};

type GrupoDia = {
  data: string;
  horario: string;
  horarioFim: string;
  tipo: string;
  local: string;
  internos: string[];
  observacao: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function intervaloDoMes(mesAno: string) {
  const [anoStr, mesStr] = mesAno.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!ano || !mes || mes < 1 || mes > 12) {
    throw new Error("Mês/ano inválido para o relatório.");
  }
  const inicio = `${ano}-${pad2(mes)}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${pad2(mes)}-${pad2(ultimoDia)}`;
  return { ano, mes, inicio, fim };
}

export function rotuloMesAno(mesAno: string) {
  const { ano, mes } = intervaloDoMes(mesAno);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function dataBr(iso: string) {
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

function observacaoDoAtendimento(i: AtendimentoMes) {
  return i.observacao && i.observacao.trim() !== "" ? i.observacao.trim() : "—";
}

function textoInternos(internos: string[]) {
  const nomes = internos.filter((nome) => nome.trim() !== "");
  if (nomes.length > 1) return nomes.join("\n");
  return nomes[0] ?? "—";
}

function rowToAtendimento(row: AtendimentoRow): AtendimentoMes {
  return {
    id: String(row.id),
    data: row.data_atendimento ?? "",
    horario: row.horario ?? "",
    horarioFim: row.horario_fim ?? "",
    interno: row.nome_interno ?? "",
    tipo: row.tipo_atendimento || "—",
    local: row.local || "—",
    observacao: row.observacao ?? undefined,
  };
}

function compararAtendimentos(a: AtendimentoMes, b: AtendimentoMes) {
  return a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario) || a.id.localeCompare(b.id);
}

export async function buscarAtendimentosDoMes(mesAno: string): Promise<AtendimentoMes[]> {
  const { inicio, fim } = intervaloDoMes(mesAno);
  const todos: AtendimentoRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("atendimentos")
      .select("*")
      .gte("data_atendimento", inicio)
      .lte("data_atendimento", fim)
      .order("data_atendimento", { ascending: true })
      .order("horario", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const pagina = (data ?? []) as AtendimentoRow[];
    todos.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return todos
    .map(rowToAtendimento)
    .filter((item) => item.data)
    .sort(compararAtendimentos);
}

function agruparPorDia(itens: AtendimentoMes[]) {
  const dias: { data: string; grupos: GrupoDia[] }[] = [];

  for (const item of itens) {
    let dia = dias.find((d) => d.data === item.data);
    if (!dia) {
      dia = { data: item.data, grupos: [] };
      dias.push(dia);
    }

    const alvo = dia.grupos.find(
      (g) =>
        g.horario === item.horario &&
        g.horarioFim === item.horarioFim &&
        g.tipo === item.tipo &&
        g.local === item.local,
    );

    if (alvo) {
      if (item.interno && !alvo.internos.includes(item.interno)) {
        alvo.internos.push(item.interno);
      }
      if (alvo.observacao === "—") alvo.observacao = observacaoDoAtendimento(item);
      continue;
    }

    dia.grupos.push({
      data: item.data,
      horario: item.horario,
      horarioFim: item.horarioFim,
      tipo: item.tipo,
      local: item.local,
      internos: item.interno ? [item.interno] : [],
      observacao: observacaoDoAtendimento(item),
    });
  }

  return dias;
}

function horarioTexto(horario: string, horarioFim: string) {
  // Se já vier com o formato "Hora – Hora", exibe direto
  if (horario.includes("–") || horario.includes("-")) {
    return horario.trim();
  }
  // Caso contrário, formate como "Hora – Hora"
  if (horario && horarioFim) return `${horario} – ${horarioFim}`;
  return horario || "—";
}

export function gerarPdfHistoricoMensal(mesAno: string, itens: AtendimentoMes[]) {
  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  const mesLabel = rotuloMesAno(mesAno);
  const total = itens.length;
  const dias = agruparPorDia(itens);

  const zebraPar: [number, number, number] = [255, 255, 255];
  const zebraImpar: [number, number, number] = [243, 244, 246];
  const bordaSuave: [number, number, number] = [209, 213, 219];
  const textoEscuro: [number, number, number] = [17, 24, 39];
  const destaque: [number, number, number] = [31, 41, 55];

  doc.setFontSize(13);
  doc.setTextColor(...textoEscuro);
  doc.text(`Histórico Mensal de Atendimentos - ${NOME_APP}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Referência: ${mesLabel}`, 14, 23);
  doc.text(`Total de atendimentos: ${total}`, 14, 29);

  const body: Array<
    Array<
      | string
      | {
          content: string;
          colSpan?: number;
          styles?: {
            fillColor?: [number, number, number];
            textColor?: number | [number, number, number];
            fontStyle?: "bold" | "normal";
            halign?: "left" | "center";
          };
        }
    >
  > = [];

  if (dias.length === 0) {
    body.push([
      {
        content: "Nenhum atendimento registrado neste mês.",
        colSpan: 6,
        styles: { halign: "left", fontStyle: "normal" },
      },
    ]);
  } else {
    for (const dia of dias) {
      body.push([
        {
          content: `Data: ${dataBr(dia.data)}`,
          colSpan: 6,
          styles: {
            fillColor: destaque,
            textColor: 255,
            fontStyle: "bold",
            halign: "left",
          },
        },
      ]);
      for (const grupo of dia.grupos) {
        body.push([
          dataBr(grupo.data),
          horarioTexto(grupo.horario, grupo.horarioFim),
          grupo.tipo,
          textoInternos(grupo.internos),
          grupo.local,
          grupo.observacao,
        ]);
      }
    }
  }

  autoTable(doc, {
    startY: 35,
    margin: { left: 14, right: 14, top: 36 },
    head: [["Data", "Horário", "Tipo de Atendimento", "Interno", "Local", "Observações"]],
    body,
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 32 },
      3: { cellWidth: 42 },
      4: { cellWidth: 30 },
      5: { cellWidth: 32 },
    },
    headStyles: {
      fillColor: destaque,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      valign: "middle",
      cellPadding: 3,
      lineColor: bordaSuave,
      lineWidth: 0.2,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: textoEscuro,
      valign: "middle",
      lineColor: bordaSuave,
      lineWidth: 0.2,
      fillColor: zebraPar,
      overflow: "linebreak",
    },
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      const raw = hookData.row.raw as Array<{ colSpan?: number } | string>;
      const primeira = raw[0];
      const ehSubcabecalho =
        typeof primeira === "object" && primeira !== null && primeira.colSpan === 6;
      if (ehSubcabecalho) {
        hookData.cell.styles.fillColor = destaque;
        hookData.cell.styles.textColor = 255;
        hookData.cell.styles.fontStyle = "bold";
        return;
      }
      const fundo = hookData.row.index % 2 === 0 ? zebraPar : zebraImpar;
      hookData.cell.styles.fillColor = fundo;
      hookData.cell.styles.textColor = textoEscuro;
    },
    didDrawPage: (hookData) => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(
        `Histórico Mensal · ${mesLabel} · página ${page}`,
        hookData.settings.margin.left,
        doc.internal.pageSize.getHeight() - 8,
      );
    },
  });

  doc.save(`historico-mensal-${mesAno}.pdf`);
  return total;
}