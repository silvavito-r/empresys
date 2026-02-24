# PRD — EmpreSys
## Product Requirements Document

**Data:** Fevereiro 2026
**Produto:** EmpreSys — Sistema de Gestão de Obras Elétricas
**Segmento:** Empresas de mão de obra elétrica para edificações


---

## 1. Visão Geral

### 1.1 Problema

Empresas de mão de obra elétrica para construção civil enfrentam dificuldades em:

- Controlar o andamento das inspeções elétricas em obras de grande porte (edificações com 30+ pavimentos, 200+ unidades) requerem:
  - Rastreabilidade: Registro detalhado de conformidade por unidade/ambiente
  - Escalabilidade: Estrutura hierárquica complexa (obra → pavimentos → unidades → ambientes)
  - Evidências: Captura de fotos e anotações técnicas in-loco
  - Gerenciamento: Atribuição em massa de ambientes, geração de relatórios de pendências
- Ter rastreabilidade do que foi inspecionado, por quem e quando
- Gerar relatórios profissionais para entrega às construtoras



### 1.3 Público-alvo

| Perfil | Uso principal |
|--------|--------------|
| Engenheiro / Responsável Técnico | Configura obras, cria checklists, analisa relatórios |
| Técnico / Eletricista de campo | Executa checklists no local via celular |
| Gerente / Liderança | Consulta relatórios de progresso e pendências |


## 3. Módulos Implementados

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

- Campos: 
  - Nome (obrigatório)
  - CNPJ (opcional)
  - Endereço: Rua (opcional), Número (opcional), Bairro (opcional), Cidade (opcional), UF (opcional), CEP (opcional)
  - Contato: Nome (opcional), Telefone (opcional), Email (opcional)
  - Upload de Imagem Logomarca (opcional)
  - Descrição (opcional)
- CRUD completo: criar, visualizar, editar, excluir (com confirmação de exclusão)
- Busca por nome
- Exibição em grid de cards, quando clicado sobre o card abre os detalhes da construtora

### 3.4 Obras

Gerenciamento dos contratos/obras:

- Campos: 
  - Nome (obrigatório)
  - Construtora vinculada (obrigatório)
  - Endereço: Rua (obrigatório), Número (obrigatório), Bairro (obrigatório), Cidade (obrigatório), UF (obrigatório), CEP (obrigatório)
  - Região (obrigatório)
  - Responsável Técnico (opcional)
  - Status: Ativa / Concluída / Pausada
- CRUD completo: criar, visualizar, editar, excluir (com confirmação de exclusão)
- Busca por nome ou construtora
- Filtros por status, construtora, região
- Link para página de estrutura da obra

### 3.5 Estrutura da Obra

Cadastro hierárquico completo da obra em 3 níveis:

**Pavimentos**
- Nomes predefinidos: Térreo, G01–G04 (garagens), Lazer, Rooftop, Casa de Máquinas, Barrilete
- Criação rápida por clique em nome predefinido
- Criação em range (ex: "Tipo 2 a Tipo 20" cria todos os pavimentos de uma vez)
- Adição de nome personalizado
- Edição inline com ícone ✏️ em todas as listas
- Confirmação de exclusão para operações destrutivas

**Unidades Residenciais, Comerciais e Condominiais**
- Vinculadas ao pavimento
- Adição individual ou em lote (textarea com um nome por linha)
- Exibidas agrupadas por pavimento

**Ambientes**
- Atribuir Ambientes em Lote 
    - Problema UX: Atribuir 6 ambientes a 228 unidades = 1.368 cliques individuais
    - Solução: Modal interativo com 3 modos de seleção

  - Passo 1: Selecionar ambientes (chips clicáveis)
    - Todos / Nenhum
    - Visual: selecionados em amarelo com ✓

  - Passo 2: Selecionar unidades
    - ✓ Todas: seleciona todas as 228 unidades
    - Por pavimento: painel com lista de pavimentos
      - Clique no pavimento seleciona/desmarca todas as unidades
      - Indicador visual: verde (100%), amarelo (parcial), cinza (0%)
    - Por filtro de nome: busca inteligente
      - Digite "Apto" → adiciona todas as unidades residenciais
      - Digite "Tipo 1" → adiciona Tipo 10-19
      - Digite "15" → adiciona Apto 1501-1508, 1505, 2015, etc.
      - Preview em tempo real: "42 unidades encontradas"

  - Confirmação:
    - Resumo: "6 ambientes → 228 unidades: Sala, Cozinha, Lavanderia..."
    - Botão habilitado apenas se ambos os conjuntos têm seleção

### 3.6 Checklists

Sistema completo de checklists de inspeção elétrica:

  #### 3.6.1 Configuração do Checklist

   - Nome e descrição do checklist
   - Vinculação a uma obra
   - Itens: Lista de verificações (ex: "Quadro de distribuição", "Entrada de Energia", "Acabamentos Elétricos")
   - Atribuição a unidades:
   - Modal de seleção por pavimento e unidade
   - Visualização hierárquica (obras → pavimentos → unidades)
   - Indicação visual de unidades já atribuídas

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
    - Cabeçalho com logo EmpreSys na direita e logo do Cliente (se possir) na esquerda
    - Identificação completa: Construtora, Obra, Endereço, Responsável pelo Checklist, Data
    - Tabela de resumo com totais e porcentagem
    - Seção de pendências formatada
    - Tabelas detalhadas por local
    - Rodapé com identificação do sistema
    - CSS `@page` configurado para A4
    - Ocultar menu lateral e menu superior

### 3.7 Administração do Sistema

Aba para gerenciamento do sistema e visualização de logs:

  #### 3.7.1 Cadastro de Usuários:

  - Aba para cadastro de novos usuários para o sistema:
    - Campos: 
      - Nome (obrigatório)
      - Email (obrigatório)
      - Senha (obrigatório)
      - Descrição (opcional)
      - Selecionar nível de acesso: Administrador / Engenharia / RH
    - CRUD completo: criar, visualizar, editar, excluir (com confirmação de exclusão)
    - Busca por nome
    - Exibição em lista, quando clicado sobre o usuário abre um modal com detalhes

  #### 3.7.2 Visualização de Logs:

  - Visualização de logs do sistema com possibilidade de filtros
  - Armazenar Logs de:
    - Login
    - Cadastro de Cliente
    - Cadastro de Obra
    - Cadastro de Checklist
    - Cadastro de Usuário
  - Configurações do Sistema


## 4. Regras de Acesso

- Serão três niveis de acesso onde cada função aparecerá ou não para o usuário definido

  1. Administrador
    - Acesso total ao sistema

  2. Engenharia
    - Sem acesso e oculto a aba de Administração do Sistema

  3. RH
    - Sem acesso e oculto a aba de Administração do Sistema e Checklists

