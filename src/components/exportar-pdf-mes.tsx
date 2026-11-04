import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  buscarAtendimentosDoMes,
  gerarPdfHistoricoMensal,
  rotuloMesAno,
} from "@/lib/pdf-historico-mensal";

type ExportarPdfMesProps = {
  dataReferencia: string;
};

function mensagemErro(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function ExportarPdfMes({ dataReferencia }: ExportarPdfMesProps) {
  const [mesAno, setMesAno] = useState(dataReferencia.slice(0, 7));
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    setMesAno(dataReferencia.slice(0, 7));
  }, [dataReferencia]);

  const exportar = async () => {
    if (!/^\d{4}-\d{2}$/.test(mesAno)) {
      toast.error("Selecione um mês e ano válidos.");
      return;
    }

    setExportando(true);
    try {
      const itens = await buscarAtendimentosDoMes(mesAno);
      if (itens.length === 0) {
        toast.message(`Nenhum atendimento em ${rotuloMesAno(mesAno)}.`);
      }
      const total = gerarPdfHistoricoMensal(mesAno, itens);
      if (total > 0) {
        toast.success(`PDF do mês gerado com ${total} atendimento${total === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      toast.error(mensagemErro(error, "Não foi possível exportar o PDF do mês."));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2">
        <span className="sr-only">Mês do relatório</span>
        <input
          type="month"
          value={mesAno}
          onChange={(e) => setMesAno(e.target.value)}
          className="rounded-[8px] border border-line bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          style={{ colorScheme: "light" }}
          aria-label="Mês e ano do histórico"
        />
      </label>
      <button
        type="button"
        onClick={() => void exportar()}
        disabled={exportando}
        className="rounded-[8px] bg-ink px-3 py-1.5 text-xs font-semibold text-surface ring-1 ring-ink transition-transform active:scale-[0.97] disabled:opacity-60"
      >
        {exportando ? "Exportando..." : "Exportar PDF do Mês"}
      </button>
    </div>
  );
}
