# Analisador Acadêmico e Simulador de CR – BCC / IC UFRJ

Plataforma **100% client-side** projetada para estudantes do Bacharelado em Ciência da Computação (IC/UFRJ) analisarem sua trajetória acadêmica, entenderem a evolução do seu rendimento e planejarem matrículas futuras com base no PPC 2022.

A partir do Boletim ou do Histórico Não Oficial do SIGA, a ferramenta reconstrói seu histórico, calcula o Coeficiente de Rendimento (CR) pela fórmula oficial, diagnostica seu desempenho por eixo formativo e simula cenários de notas para o próximo período — tudo sem que nenhum dado saia do seu navegador.

## Recursos

### Parser robusto do SIGA

Extração de notas, períodos e metadados do aluno diretamente do PDF do **Boletim** ou do **Histórico Não Oficial** via `pdf.js`, executado em Web Worker no próprio navegador. O parser lida com o layout de coordenadas do SIGA (códigos MAB e ICP, situações finais, créditos e pontos) e tolera linhas malformadas sem abortar o documento.

### Auditoria de reprovações e documentos

A ferramenta detecta automaticamente o tipo de arquivo importado. Como o Histórico Escolar omite reprovações (RM, RF, RFM), um aviso é exibido quando esse documento é usado, alertando que o CR calculado pode divergir do oficial — por isso o Boletim é a fonte recomendada.

### Simulador dinâmico e integração com o BOA

- Importação automática das disciplinas pendentes recomendadas a partir do `boa.pdf` (Boletim de Orientação Acadêmica), direto para o simulador.
- Recálculo em tempo real do CR do período, do novo CR acumulado e do impacto sobre o histórico.
- **Meta reversa**: informe um CR alvo e descubra a média necessária nas disciplinas restantes.

### Dashboard de evolução histórica

- Gráfico SVG da evolução do CR com duas séries: **CR Acumulado** (linha contínua) vs. **CR do Período** (linha tracejada).
- Tooltips contextuais por período com CRs, variação e a lista de disciplinas cursadas com seus graus.
- Cards de métricas: melhor e pior semestre, créditos integralizados e taxa de sucesso.

### Categorização por eixos temáticos (PPC 2022)

Agrupamento das disciplinas cursadas nos eixos formativos oficiais do curso, com CR ponderado por eixo:

- Teoria da Computação e Matemática
- Sistemas Computacionais e Comunicação
- Engenharia de Software e Aplicações
- Ciência de Dados e Computação Científica
- Formação Humana, Social e Complementar
- Eletivas
- Não Confere Grau (transferências, NCG e disciplinas em curso)

Equivalências históricas **MAB → ICP** são respeitadas: uma disciplina da grade antiga é atribuída ao eixo da sua equivalente no PPC 2022.

## Privacidade e segurança

- **Sem backend**: a aplicação é uma SPA estática — não existe servidor de aplicação, API ou banco de dados.
- **Zero tráfego de dados pessoais**: todo o processamento de PDF acontece na memória do navegador do aluno, em Web Worker. Nenhum byte do seu histórico é enviado pela rede.
- **Persistência local**: os dados processados ficam no `localStorage` do navegador (com fallback em memória), e podem ser exportados/importados manualmente via JSON.

## Como executar localmente

Requisitos: um navegador moderno (Chrome, Edge, Firefox, Safari) e um servidor estático simples.

```bash
npx serve
```

ou

```bash
python -m http.server 8080
```

Depois abra o endereço exibido (ex.: `http://localhost:8080` ou `http://localhost:3000`) e importe seu PDF do SIGA.

## Arquivos principais

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Aplicação principal (SPA) com as três abas: Histórico, Planejamento Pedagógico e Análise. |
| `docs.html` | Documentação detalhada das regras de cálculo, formatos e segurança. |
| `js/` | Módulos JavaScript: parsers (`pdfParser`, `boaParser`), motor de cálculo (`calculator`), eixos (`eixos`), persistência (`storage`) e UI (`ui`, `app`). |
| `css/styles.css` | Estilos, identidade visual IC/UFRJ e temas Claro/Escuro. |

## Licença

MIT
