# PRD — EmpreSys
## Product Requirements Document

**Versão:** 1.0
**Data:** Fevereiro 2026
**Produto:** EmpreSys — Sistema de Gestão de Obras Elétricas
**Segmento:** Empresas de mão de obra elétrica para edificações
**Localização:** Balneário Camboriú, SC, Brasil

---

## 1. Visão Geral

### 1.1 Problema

Empresas de mão de obra elétrica para construção civil enfrentam dificuldades em:

- Controlar o andamento das verificações elétricas por unidade em grandes obras
- Registrar e comunicar não conformidades para a liderança com evidências (fotos, notas)
- Ter rastreabilidade do que foi inspecionado, por quem e quando
- Gerar relatórios profissionais para entrega às construtoras

Atualmente esses processos são feitos com papel, planilhas Excel ou WhatsApp, o que gera perda de informação, retrabalho e falta de profissionalismo na entrega para o cliente.

### 1.2 Solução

O EmpreSys é uma aplicação web responsiva (funciona em celular no campo) que centraliza a gestão de obras, equipes e checklists de inspeção elétrica. Permite criar verificações estruturadas por pavimento, unidade ou ambiente, executar as inspeções no local com registro de fotos e notas, e gerar relatórios profissionais para a liderança e construtoras.

### 1.3 Público-alvo

| Perfil | Uso principal |
|--------|--------------|
| Engenheiro / Responsável Técnico | Configura obras, cria checklists, analisa relatórios |
| Técnico / Eletricista de campo | Executa checklists no local via celular |
| Gerente / Liderança | Consulta relatórios de progresso e pendências |

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Estilização | Tailwind CSS v3 + shadcn/ui |
| Backend / Banco | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (email + senha) |
| Armazenamento de fotos | Supabase Storage (bucket `checklist-fotos`) |
| Hosting | GitHub Pages (`silvavito-r.github.io/empresys`) |
| Repositório | `github.com/silvavito-r/empresys` |

---

## 3. Módulos Implementados (v1.0)

### 3.1 Autenticação

- Login com email e senha
- Sessão persistente via Supabase Auth
- Proteção de rotas (redirect para login se não autenticado)
- Logout no header da aplicação

### 3.2 Dashboard

Tela inicial pós-login com resumo executivo:

- Total de clientes cadastrados
- Total de obras (com destaque nas ativas)
- Total de checklists (com destaque nos em andamento)
- Pendências críticas em vermelho (itens Não OK)
- Lista rápida de obras recentes
- Lista rápida de checklists recentes

### 3.3 Clientes (Construtoras)

Gerenciamento das construtoras contratantes:

- Campos: Nome (obrigatório), CNPJ (opcional), Endereço (opcional)
- CRUD completo: criar, visualizar, editar, excluir
- Busca por nome
- Exibição em grid de cards

### 3.4 Obras

Gerenciamento dos contratos/obras:

- Campos: Nome, Construtora vinculada, Endereço, Responsável técnico, Status
- Status: Ativa / Concluída / Pausada
- CRUD completo com busca
- Link para página de estrutura da obra

### 3.5 Estrutura da Obra

Cadastro hierárquico completo da obra em 3 níveis:

**Pavimentos**
- Nomes predefinidos: Térreo, G01–G04 (garagens), Lazer, Tipo 7–20, Casa de Máquinas, Barrilete
- Criação rápida por clique em nome predefinido
- Criação em range (ex: "Tipo 2 a Tipo 20" cria todos os pavimentos de uma vez)
- Adição de nome personalizado

**Unidades**
- Vinculadas ao pavimento
- Adição individual ou em lote (textarea com um nome por linha)
- Exibidas agrupadas por pavimento

**Ambientes**
- Vinculados à unidade
- Nomes predefinidos: Sala, Cozinha, Banheiro, Área de Serviço, Quarto 1, Quarto 2, Suíte, Varanda, Hall
- Adição personalizada
- Exibidos em grid por unidade

### 3.6 Checklists

Sistema completo de checklists de inspeção elétrica:

#### 3.6.1 Configuração do Checklist

- Nome e descrição do checklist
- Vinculação a uma obra
- Itens de verificação com **escopo por item**:
  - **Por Pavimento** — 1 verificação por andar (ex: quadro de distribuição)
  - **Por Unidade** — 1 verificação por apartamento/espaço (padrão)
  - **Por Ambiente** — 1 verificação por cômodo (sala, quarto, etc.)
- Edição de itens disponível em qualquer status (Rascunho ou Ativo)
- Cálculo automático do total de verificações antes de ativar

#### 3.6.2 Ativação

Ao ativar, o sistema cria automaticamente todas as combinações `item × local` conforme o escopo de cada item:
- Itens de pavimento → 1 execução por pavimento
- Itens de unidade → 1 execução por unidade
- Itens de ambiente → 1 execução por ambiente

#### 3.6.3 Lista de Checklists

- Grid de cards com status badge (Rascunho / Ativo / Concluído)
- **Barra de progresso com %** e contagem `X/Y verificações` para checklists ativos
- Botão de acesso rápido "Executar" direto na lista
- Busca por nome ou obra

#### 3.6.4 Execução de Campo

Navegação hierárquica e intuitiva:

1. **Seletor de Pavimento** — botões coloridos
2. **Seção Azul — Verificações do Pavimento** (itens de escopo pavimento)
3. **Seletor de Unidade** — com % de progresso e indicação vermelha se há Não OK
4. **Seção Verde — Verificações da Unidade** (itens de escopo unidade)
5. **Seletor de Ambiente** — quando há itens de escopo ambiente
6. **Seção Roxa — Verificações do Ambiente**

Para cada item:
- Botões de status: **OK** (verde) / **Não OK** (vermelho) / **N/A** (amarelo)
- Botão de **nota** — texto livre para descrever a situação
- Botão de **foto** — câmera nativa do celular, upload para Supabase Storage
- Salvamento imediato (sem necessidade de confirmar ou salvar manualmente)
- Progresso geral no topo com barra de porcentagem

#### 3.6.5 Relatório

Relatório profissional com duas versões:

**Versão tela:**
- Cards de resumo: OK / Não OK / N/A / Pendentes
- Barra de progresso geral
- Seção de pendências e não conformidades destacada em vermelho
- Tabelas detalhadas separadas por escopo (pavimento, unidade, ambiente)
- Filtros: Todos / OK / Não OK / Pendentes

**Versão impressa (PDF/A4):**
- Cabeçalho com logo EmpreSys
- Identificação completa: Construtora, Obra, Endereço, Responsável, Data
- Tabela de resumo com totais e porcentagem
- Seção de pendências formatada
- Tabelas detalhadas por local
- Rodapé com identificação do sistema
- CSS `@page` configurado para A4

---

## 4. Modelo de Dados

### Diagrama de Entidades

```
clientes
  └── obras
        ├── pavimentos
        │     └── unidades
        │           └── ambientes
        └── checklists
              ├── checklist_itens (scope: pavimento|unidade|ambiente)
              └── checklist_execucoes (item × local, com status/nota/foto)
```

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `clientes` | Construtoras contratantes |
| `obras` | Projetos/contratos de obra |
| `pavimentos` | Andares de uma obra |
| `unidades` | Apartamentos/espaços de um pavimento |
| `ambientes` | Cômodos de uma unidade |
| `checklists` | Modelos de verificação vinculados a uma obra |
| `checklist_itens` | Itens de um checklist com escopo definido |
| `checklist_execucoes` | Resultado de cada item × local (status, nota, foto) |

### Segurança

- Row Level Security (RLS) ativado em todas as tabelas
- Política MVP: usuários autenticados têm acesso total
- Fotos armazenadas em bucket público (leitura) com upload restrito a autenticados

---

## 5. Arquitetura Frontend

### Estrutura de Rotas

```
/                     → redirect para /dashboard
/login                → LoginPage
/dashboard            → DashboardPage
/clientes             → ClientesPage
/obras                → ObrasPage
/obras/:id            → ObraDetalhePage
/checklists           → ChecklistsPage
/checklists/:id       → ChecklistDetalhePage
/checklists/:id/executar   → ChecklistExecucaoPage
/checklists/:id/relatorio  → ChecklistRelatorioPage
```

### Componentes de Layout

- `Sidebar` — navegação fixa lateral (desktop) com logo e links
- `Header` — barra superior com título da página, email do usuário e logout
- `AppLayout` — wrapper com Sidebar + Header + conteúdo principal

---

## 6. Roadmap — Funcionalidades Futuras

### Fase 2 — Gestão de Equipe

- [ ] Cadastro de colaboradores (nome, função, contato)
- [ ] Atribuição de colaboradores a obras
- [ ] Controle de presença / horas trabalhadas
- [ ] Roles de acesso: Administrador / Técnico / Visualizador

### Fase 3 — Materiais e Comissionamento

- [ ] Relação de materiais por obra (lista de insumos, quantidades)
- [ ] Controle de recebimento de materiais
- [ ] Gestão de comissionamento CELESC (documentação, prazos, pendências)
- [ ] Assinatura digital de laudos

### Fase 4 — Relatórios Avançados

- [ ] Dashboard gerencial com gráficos de evolução
- [ ] Exportação de relatório em PDF nativo (sem depender da impressão do browser)
- [ ] Histórico de alterações por item (quem mudou, quando)
- [ ] Comparativo entre checklists da mesma obra

### Fase 5 — Offline e Mobile

- [ ] PWA (Progressive Web App) com ícone na tela inicial do celular
- [ ] Execução de checklist offline com sync quando voltar a ter conexão
- [ ] Notificações push para pendências críticas

---

## 7. Restrições e Decisões Técnicas

| Decisão | Justificativa |
|---------|--------------|
| GitHub Pages como hosting | Custo zero, adequado para SPA com React Router |
| Supabase como backend | Banco, auth e storage em uma plataforma, sem servidor próprio |
| shadcn/ui criado manualmente | Evitar CLI interativa; componentes estão no código-fonte |
| Supabase client sem tipagem gerada | Para evitar erros de TypeScript na fase inicial; tipos manuais em `database.ts` |
| Salvamento imediato na execução | UX de campo: sem risco de perder dados se fechar o app |

---

## 8. URLs do Projeto

| Recurso | URL |
|---------|-----|
| Aplicação (produção) | https://silvavito-r.github.io/empresys/ |
| Repositório GitHub | https://github.com/silvavito-r/empresys |
| Supabase Dashboard | https://supabase.com/dashboard/project/uycutwogahbtpniibtoh |

---

## 9. Deploy e Manutenção

### Deploy de nova versão

```bash
npm run deploy
```

Isso executa automaticamente o build e publica no GitHub Pages.

### Migrações de banco

Arquivos SQL na raiz do projeto:
- `supabase-schema.sql` — Schema inicial completo
- `supabase-migration-v2.sql` — Migration v2 (scope, ambiente_id)

Executar manualmente no **Supabase Dashboard → SQL Editor**.
