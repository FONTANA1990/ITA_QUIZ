import Papa from "papaparse";

export type ParsedQuestion = {
  question_text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_option: string;
};

export function parseCSV(file: File): Promise<ParsedQuestion[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = results.data
            .map((row: any, idx: number) => ({ row, lineNum: idx + 2 })) // linha 1 é o header
            .filter(({ row }) => {
              // Pular linhas que sejam cabeçalhos duplicados
              return row.pergunta && row.pergunta.toLowerCase().trim() !== "pergunta";
            })
            .map(({ row, lineNum }) => {
              const requiredFields = [
                "pergunta",
                "opcao_a",
                "opcao_b",
                "opcao_c",
                "opcao_d",
                "resposta_correta",
              ];

              // Validação de campos em branco
              for (const field of requiredFields) {
                if (!row[field]) {
                  throw new Error(`Linha ${lineNum}: campo "${field}" vazio`);
                }
              }

              const resposta = String(row.resposta_correta).toUpperCase().trim();

              if (!["A", "B", "C", "D"].includes(resposta)) {
                throw new Error(
                  `Linha ${lineNum}: resposta inválida ("${resposta}"). Use apenas A, B, C ou D.`
                );
              }

              return {
                question_text: String(row.pergunta).trim(),
                options: {
                  A: String(row.opcao_a).trim(),
                  B: String(row.opcao_b).trim(),
                  C: String(row.opcao_c).trim(),
                  D: String(row.opcao_d).trim(),
                },
                correct_option: resposta,
              };
            });

          if (parsed.length === 0) {
            throw new Error("Nenhuma pergunta válida encontrada no CSV.");
          }

          resolve(parsed);
        } catch (err: any) {
          reject(err); // Rejeita como objeto Error para o catch do front-end pegar a mensagem
        }
      },
      error: (error) => {
        reject(new Error(error.message));
      }
    });
  });
}
