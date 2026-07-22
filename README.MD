# AMMIS Moda — Desenvolvimento do Tema Shopify

Este repositório contém o código do tema Shopify da loja AMMIS Moda.

O projeto utiliza integração entre:

* GitHub
* Shopify
* Shopify CLI
* Desenvolvimento local com VS Code
* Branches separadas para produção e redesign

O objetivo desta estrutura é permitir alterações, testes e validações sem modificar imediatamente o tema publicado da loja.

---

## 1. Estrutura dos ambientes

O projeto possui dois ambientes principais.

### Produção

```text
Branch GitHub: main
Tema Shopify: ammis-moda/main
Status Shopify: live
ID do tema: 149120614502
```

A branch `main` está vinculada ao tema atualmente publicado na loja.

Qualquer alteração enviada para essa branch pode ser refletida no site em produção.

### Desenvolvimento e redesign

```text
Branch GitHub: redesign
Tema Shopify: ammis-moda/redesign
Status Shopify: unpublished
ID do tema: 149269250150
```

A branch `redesign` está vinculada ao tema não publicado utilizado para desenvolvimento, homologação e validação.

Todas as alterações da reformulação devem ser feitas exclusivamente nessa branch.

---

## 2. Dados da loja

```text
Domínio público:
https://ammismoda.com.br

Domínio permanente Shopify:
11yf2x-2c.myshopify.com

Painel administrativo:
https://admin.shopify.com/store/11yf2x-2c
```

Para comandos da Shopify CLI, utilizar sempre o domínio permanente:

```text
11yf2x-2c.myshopify.com
```

Não utilizar o domínio público `ammismoda.com.br` nos comandos da CLI.

---

## 3. Requisitos do ambiente local

Antes de trabalhar no projeto, instalar:

* Git
* Node.js
* npm
* Shopify CLI
* Visual Studio Code

Versões validadas no ambiente original:

```text
Git: 2.53.0
Node.js: 24.17.0
npm: 11.13.0
Shopify CLI: 4.5.2
```

Versões superiores podem funcionar, desde que sejam compatíveis com a Shopify CLI.

---

## 4. Verificar ferramentas instaladas

Abra o PowerShell ou o terminal integrado do VS Code e execute:

```powershell
git --version
node --version
npm --version
shopify version
```

Todos os comandos devem retornar uma versão válida.

Caso o comando `shopify` não seja reconhecido, consulte a seção de instalação e configuração da Shopify CLI.

---

## 5. Instalar a Shopify CLI

Execute:

```powershell
npm install -g @shopify/cli@latest
```

Depois verifique:

```powershell
shopify version
```

### Caso o comando `shopify` não seja reconhecido

Verifique o diretório global do npm:

```powershell
npm prefix -g
```

No Windows, o resultado normalmente será:

```text
C:\Users\SEU_USUARIO\AppData\Roaming\npm
```

Verifique se os arquivos da Shopify CLI existem:

```powershell
Get-ChildItem "$(npm prefix -g)" | Where-Object { $_.Name -like "shopify*" }
```

Teste diretamente:

```powershell
& "$(npm prefix -g)\shopify.cmd" version
```

Caso funcione apenas dessa forma, adicione o diretório global do npm ao `PATH` do usuário:

```powershell
$npmPath = "$(npm prefix -g)"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

if (($userPath -split ";") -notcontains $npmPath) {
    [Environment]::SetEnvironmentVariable(
        "Path",
        ($userPath.TrimEnd(";") + ";" + $npmPath),
        "User"
    )
}
```

Depois:

1. Feche completamente o VS Code.
2. Finalize todos os processos `Code.exe`, se necessário.
3. Abra novamente o VS Code.
4. Crie um novo terminal.
5. Execute:

```powershell
shopify version
```

---

## 6. Clonar o repositório em outro computador

Escolha a pasta onde o projeto será salvo.

Exemplo:

```powershell
cd "C:\Users\SEU_USUARIO\Desktop"
```

Clone o repositório:

```powershell
git clone https://github.com/Andreh-Malheiros/ammis-moda.git
```

Entre na pasta:

```powershell
cd ammis-moda
```

Substitua `https://github.com/Andreh-Malheiros/ammis-moda.git` pela URL HTTPS ou SSH real do GitHub.

Exemplo de formato HTTPS:

```powershell
git clone https://github.com/Andreh-Malheiros/ammis-moda.git
```

Exemplo de formato SSH:

```powershell
git clone git@github.com/Andreh-Malheiros/ammis-moda.git
```

---

## 7. Autenticação no GitHub

Como o repositório é privado, será necessário autenticar a conta que possui acesso.

### Opção recomendada: GitHub CLI

Instale a GitHub CLI e execute:

```powershell
gh auth login
```

Selecione:

```text
GitHub.com
HTTPS
Login pelo navegador
```

Depois confirme:

```powershell
gh auth status
```

### Alternativa

Também é possível utilizar:

* autenticação pelo navegador do Git Credential Manager;
* token pessoal do GitHub;
* chave SSH.

Não salvar senhas ou tokens diretamente neste arquivo.

---

## 8. Entrar na branch correta

Após clonar o repositório, execute:

```powershell
git fetch origin
```

Liste as branches:

```powershell
git branch -a
```

Entre na branch de desenvolvimento:

```powershell
git switch --track origin/redesign
```

Caso a branch já exista localmente:

```powershell
git switch redesign
```

Atualize a branch:

```powershell
git pull origin redesign
```

Confirme:

```powershell
git branch --show-current
git status
```

Resultado esperado:

```text
redesign
```

```text
On branch redesign
Your branch is up to date with 'origin/redesign'.

nothing to commit, working tree clean
```

---

## 9. Regra crítica de segurança

Antes de qualquer alteração, sempre execute:

```powershell
git branch --show-current
```

A resposta deve ser:

```text
redesign
```

Nunca iniciar alterações caso o retorno seja:

```text
main
```

A branch `main` está vinculada ao tema publicado da loja.

Durante o redesign, não executar na `main`:

```text
commit
push
merge
rebase
reset
checkout de arquivos
alterações de código
```

---

## 10. Autenticação na Shopify

Utilize sua própria conta Shopify, adicionada como membro da loja.

Primeiro, confirme que consegue acessar o painel:

```text
https://admin.shopify.com/store/11yf2x-2c
```

Depois, no terminal, execute:

```powershell
shopify theme list --store 11yf2x-2c.myshopify.com
```

Na primeira execução, a Shopify CLI exibirá um código e abrirá o navegador para autenticação.

Entre com a conta autorizada na loja.

Resultado esperado:

```text
ammis-moda/main
role: live
id: 149120614502

ammis-moda/redesign
role: unpublished
id: 149269250150
```

---

## 11. IDs dos temas

### Tema publicado

```text
Nome: ammis-moda/main
ID: 149120614502
Status: live
Branch: main
```

### Tema de desenvolvimento

```text
Nome: ammis-moda/redesign
ID: 149269250150
Status: unpublished
Branch: redesign
```

Durante o desenvolvimento, utilizar exclusivamente:

```text
149269250150
```

Não utilizar o tema publicado:

```text
149120614502
```

---

## 12. Listar os temas da loja

Comando seguro de leitura:

```powershell
shopify theme list --store 11yf2x-2c.myshopify.com
```

Esse comando apenas consulta os temas existentes.

Ele não envia arquivos, não altera o site e não publica nenhum tema.

---

## 13. Fluxo antes de iniciar qualquer trabalho

Sempre executar:

```powershell
cd "CAMINHO_DO_PROJETO"
```

Exemplo no computador atual:

```powershell
cd "C:\Users\admin\Desktop\ammis-ecommerce\ammis-moda"
```

Depois:

```powershell
git switch redesign
git pull origin redesign
git branch --show-current
git status
```

Validar:

```text
Branch atual: redesign
Arquivos pendentes: nenhum
Branch sincronizada com origin/redesign
```

Somente depois iniciar alterações.

---

## 14. Fluxo de desenvolvimento

Após modificar arquivos:

```powershell
git status
```

Revise os arquivos alterados:

```powershell
git diff
```

Adicione os arquivos:

```powershell
git add .
```

Crie um commit:

```powershell
git commit -m "feat: descrição objetiva da alteração"
```

Envie para a branch de desenvolvimento:

```powershell
git push origin redesign
```

Como a branch `redesign` está vinculada ao tema Shopify não publicado, o push atualizará o tema:

```text
ammis-moda/redesign
```

O tema publicado não deverá ser alterado.

---

## 15. Padrão de commits

Utilizar mensagens objetivas.

### Novas funcionalidades

```powershell
git commit -m "feat: adiciona nova seção de benefícios"
```

### Correções

```powershell
git commit -m "fix: corrige comportamento do menu mobile"
```

### Alterações visuais

```powershell
git commit -m "style: atualiza espaçamentos da página inicial"
```

### Refatorações

```powershell
git commit -m "refactor: reorganiza scripts do seletor de variantes"
```

### Documentação

```powershell
git commit -m "docs: atualiza instruções de desenvolvimento"
```

---

## 16. Preview do tema de redesign

O tema de desenvolvimento pode ser visualizado pelo painel da Shopify:

```text
Loja virtual
→ Temas
→ ammis-moda/redesign
→ Visualizar
```

Também pode ser aberto pelo editor visual:

```text
Loja virtual
→ Temas
→ ammis-moda/redesign
→ Personalizar
```

O tema permanece não publicado.

Clientes que acessarem normalmente:

```text
https://ammismoda.com.br
```

continuarão vendo o tema vinculado à `main`.

---

## 17. Cuidados com o editor visual da Shopify

O editor visual pode alterar arquivos como:

```text
config/settings_data.json
templates/*.json
sections/*.json
```

Antes de trabalhar localmente, sempre executar:

```powershell
git pull origin redesign
```

Isso reduz o risco de sobrescrever configurações feitas pelo editor visual.

Evitar alterar simultaneamente o mesmo template:

* pelo código local;
* pelo editor visual da Shopify;
* por outro computador.

---

## 18. Comandos que exigem atenção

Os comandos abaixo podem alterar temas da Shopify e não devem ser executados sem conferir o tema de destino:

```powershell
shopify theme push
shopify theme pull
shopify theme publish
shopify theme delete
```

Nunca executar um comando de alteração sem informar explicitamente:

```text
Loja:
11yf2x-2c.myshopify.com

Tema de desenvolvimento:
149269250150
```

---

## 19. Comandos proibidos durante o redesign

Não executar:

```powershell
shopify theme publish
```

Não enviar alterações diretamente para:

```text
Tema: 149120614502
Branch: main
```

Não executar:

```powershell
git push origin main
```

Não fazer merge para `main` antes da validação final.

Não publicar o tema de redesign pelo painel da Shopify durante o desenvolvimento.

---

## 20. Verificações antes de cada push

Execute:

```powershell
git branch --show-current
git status
git diff --stat
git remote -v
```

Confirme:

```text
Branch: redesign
Destino: origin/redesign
Tema vinculado: 149269250150
```

Depois:

```powershell
git push origin redesign
```

---

## 21. Trabalhar alternando entre computadores

Antes de começar em qualquer computador:

```powershell
git switch redesign
git pull origin redesign
git status
```

Depois de finalizar o trabalho:

```powershell
git status
git add .
git commit -m "tipo: descrição da alteração"
git push origin redesign
```

Nunca encerrar uma sessão com alterações importantes sem commit ou sem sincronização.

Caso existam alterações não concluídas, avaliar antes de trocar de computador.

Uma opção temporária é:

```powershell
git stash push -m "trabalho temporário"
```

Para recuperar:

```powershell
git stash list
git stash pop
```

O uso de `stash` deve ser pontual. Sempre preferir commits pequenos e identificáveis.

---

## 22. Verificar se existem atualizações remotas

Execute:

```powershell
git fetch origin
git status
```

Para visualizar diferenças entre a branch local e a remota:

```powershell
git log --oneline --decorate --graph --all -20
```

Caso a branch local esteja desatualizada:

```powershell
git pull origin redesign
```

---

## 23. Resolver autenticação incorreta na Shopify

Caso a CLI autentique a conta errada:

```powershell
shopify auth logout
```

Depois:

```powershell
shopify theme list --store 11yf2x-2c.myshopify.com
```

Entre novamente com a conta correta.

---

## 24. Resolver erro de acesso à loja

Caso apareça:

```text
You are not authorized to use the CLI
```

Verifique:

1. Se foi utilizado o domínio permanente:

```text
11yf2x-2c.myshopify.com
```

2. Se a conta já acessou o painel administrativo da loja pelo menos uma vez.

3. Se a conta possui permissão para temas.

4. Se a autenticação foi feita com a conta correta.

Não utilizar:

```text
ammismoda.com.br
```

A CLI pode interpretar incorretamente esse domínio.

---

## 25. Sincronização com a Shopify

A integração atual funciona da seguinte forma:

```text
GitHub branch main
→ tema ammis-moda/main
→ site publicado
```

```text
GitHub branch redesign
→ tema ammis-moda/redesign
→ ambiente não publicado
```

Um push para `redesign` deve atualizar apenas o tema de desenvolvimento.

Um push para `main` pode atualizar o tema publicado.

---

## 26. Publicação futura

A publicação somente deverá ocorrer após:

* conclusão do redesign;
* revisão visual;
* testes mobile;
* testes desktop;
* testes de produtos;
* testes de variantes;
* testes de carrinho;
* testes de formulários;
* testes de páginas institucionais;
* validação da equipe;
* backup do tema atual.

Fluxo recomendado:

```text
redesign
→ Pull Request
→ revisão
→ aprovação
→ merge controlado para main
→ validação em produção
```

Não publicar diretamente o tema `redesign` sem decisão prévia sobre o fluxo final.

---

## 27. Checklist de início

```text
[ ] Estou na pasta correta
[ ] A Shopify CLI está funcionando
[ ] Estou autenticado na conta correta
[ ] A branch atual é redesign
[ ] A branch está atualizada
[ ] O git status está limpo
[ ] O tema de destino é 149269250150
[ ] Não estou trabalhando na main
```

Comandos:

```powershell
shopify version
git branch --show-current
git pull origin redesign
git status
shopify theme list --store 11yf2x-2c.myshopify.com
```

---

## 28. Checklist de encerramento

```text
[ ] Revisei os arquivos alterados
[ ] Testei a alteração
[ ] Confirmei que continuo na redesign
[ ] Criei um commit descritivo
[ ] Enviei para origin/redesign
[ ] Não alterei a main
[ ] Não publiquei nenhum tema
```

Comandos:

```powershell
git branch --show-current
git status
git diff --stat
git add .
git commit -m "tipo: descrição"
git push origin redesign
git status
```

---

## 29. Resumo operacional

Para começar:

```powershell
cd "CAMINHO_DO_PROJETO"
git switch redesign
git pull origin redesign
git status
```

Para verificar a Shopify:

```powershell
shopify theme list --store 11yf2x-2c.myshopify.com
```

Para salvar alterações:

```powershell
git add .
git commit -m "tipo: descrição"
git push origin redesign
```

Tema correto de desenvolvimento:

```text
149269250150
```

Tema publicado que não deve ser alterado:

```text
149120614502
```

Branch correta:

```text
redesign
```

Branch de produção:

```text
main
```

---

## 30. Regra final

Durante toda a reformulação:

```text
Trabalhar exclusivamente na branch redesign.
Validar exclusivamente no tema ammis-moda/redesign.
Não publicar.
Não alterar a main.
Não utilizar o ID do tema live.
```
