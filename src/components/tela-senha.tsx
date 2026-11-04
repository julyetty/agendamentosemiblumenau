import { useState, type FormEvent } from "react";
import { AUTH_STORAGE_KEY, NOME_APP, SENHA_ACESSO } from "@/lib/app-config";

const inputCls =
  "w-full rounded-[8px] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

type TelaSenhaProps = {
  onAutenticado: () => void;
};

export { AUTH_STORAGE_KEY };

export function TelaSenha({ onAutenticado }: TelaSenhaProps) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const entrar = (e: FormEvent) => {
    e.preventDefault();
    if (senha !== SENHA_ACESSO) {
      setErro("Senha incorreta. Tente novamente.");
      return;
    }
    sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    setErro("");
    onAutenticado();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 font-sans text-ink antialiased">
      <div className="w-full max-w-[420px] rounded-[16px] bg-panel p-8 shadow-sm ring-1 ring-black/5">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-[10px] bg-ink text-surface">
            <span className="text-sm font-semibold tracking-tight">AS</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">{NOME_APP}</h1>
          <p className="mt-2 text-sm text-ink/70">Informe a senha para acessar o sistema.</p>
        </div>
        <form onSubmit={entrar} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink">Senha de Acesso</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro("");
              }}
              autoComplete="current-password"
              className={inputCls}
            />
          </label>
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <button
            type="submit"
            className="w-full rounded-[8px] bg-ink px-4 py-2.5 text-sm font-medium text-surface ring-1 ring-ink transition-transform active:scale-[0.98]"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

export function sairDaSessao() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
