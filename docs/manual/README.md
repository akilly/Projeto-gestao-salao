# Manual da usuária (com prints)

- **[Manual-Hanne.pdf](Manual-Hanne.pdf)**: 27 páginas em formato apresentação (16:9), com as telas do sistema e marcadores numerados.
- Também importado no Canva para edição.

## Como atualizar os prints

Os arquivos em `fonte/` recriam o manual a partir do sistema rodando localmente (`npm run dev` + `npm run user:test:create`):

1. `node fonte/cap2.mjs`: tira os prints da demonstração e salva a posição de cada botão marcado (`boxes.json`).
2. `node fonte/wa.mjs`: prints do WhatsApp no sistema, com um conector simulado (não conecta a nenhum número real).
3. `python3 fonte/build.py` e `node fonte/render.mjs`: montam o HTML e geram o PDF.

Os scripts usam caminhos em `/tmp/manual`; ajuste se rodar em outra máquina.
