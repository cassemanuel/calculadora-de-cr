# Análise Acadêmica BCC – IC/UFRJ

Plataforma **100% client-side** para estudantes do Bacharelado em Ciência da Computação da UFRJ analisarem sua evolução acadêmica, diagnosticarem o cumprimento do PPC 2022 e planejarem os próximos semestres. 

Toda a extração de dados ocorre a partir do **Boletim Não Oficial** ou do **BOA** diretamente no seu navegador.

## Como utilizar

1. Inicie um servidor estático local na raiz do projeto:
   ```bash
   npx serve
   # ou
   python -m http.server 8080
   ```
2. Acesse `http://localhost:8080` (ou a porta correspondente).
3. Na aba **Histórico**, faça upload do seu Boletim Não Oficial do SIGA.
4. Navegue pelas abas para visualizar o seu **Planejamento Pedagógico** (importando pendências do BOA) e a sua **Análise e Evolução** (CR por eixos temáticos e elegibilidade para estágio).

## Segurança e Privacidade

Esta ferramenta foi projetada com foco absoluto na proteção dos dados acadêmicos do aluno. **Nenhum arquivo ou dado trafega pela rede.** Toda a infraestrutura roda na memória da sua aba.

* **Arquitetura Client-Side:** Não há backend. O `pdf.js` roda isolado em um Web Worker no navegador.
* **Validação de Uploads:** Defesa ativa contra arquivos corrompidos ou maliciosos (limite estrito de tamanho, validação de MIME type e limite máximo de leitura de páginas por documento para evitar exaustão de recursos/ReDoS).
* **Prevenção contra injeção de código:**
  * O parser desativa execuções nativas do PDF (`isEvalSupported: false`).
  * Não há uso de `innerHTML` na aplicação. Todo o DOM é construído de forma segura.
  * Sanitização de links e proteção no parser JSON de exportação/importação.
* **Armazenamento:** Persistência exclusivamente local (através de `localStorage`). 

## Licença

MIT
