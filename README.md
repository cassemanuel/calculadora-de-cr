# Calculadora de CR – IC/UFRJ

Calculadora e simulador de CR **100% local** para estudantes da UFRJ a partir do boletim/histórico do SIGA.

## Requisitos

- Navegador moderno (Edge, Chrome, Firefox, Safari).
- Um servidor local simples (Node.js ou Python).

## Como executar

1. Na pasta do projeto, execute um servidor estático local:

```bash
npx serve
```

ou

```bash
python -m http.server 8080
```

2. Abra o endereço no navegador (ex: `http://localhost:8080` ou `http://localhost:3000`).

## Arquivos principais

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Aplicação principal (SPA). |
| `docs.html` | Documentação detalhada sobre regras de cálculo e uso. |
| `js/` | Módulos JavaScript (parser, cálculo, UI, persistência). |
| `css/styles.css` | Estilos, identidade visual IC/UFRJ e temas Claro/Escuro. |

## Privacidade

Todo o processamento ocorre no navegador. Nenhum dado pessoal ou histórico escolar é enviado para a internet.

## Licença

MIT
