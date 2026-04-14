const puppeteer = require('puppeteer');
const util = require('util');
const exec = util.promisify(require('child_process').exec); // Permite usar async/await no exec

// Novas Configurações
const URL_DO_SITE = 'https://gemini.google.com/'; 
const SELETOR_COMANDO = 'code'; // Pega o código isolado do Angular
const SELETOR_CAIXA_TEXTO = '.ql-editor'; // Pega o editor de texto rico
const TEMPO_DE_ESPERA_MS = 10000;
// O seletor do botão de parar. No Gemini em português, geralmente ele tem esse aria-label.
// Se estiver em inglês, pode ser 'button[aria-label*="Stop"]'
const SELETOR_BOTAO_STOP = 'button[aria-label*="Parar"]';

async function iniciarBot() {
    console.log('🤖 Iniciando o bot...');
    console.log('🔗 Conectando ao seu Chrome pessoal...');
    
    const browser = await puppeteer.connect({ 
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: null 
    });
    
    const abasAbertas = await browser.pages();
    let page = abasAbertas.find(aba => aba.url().includes('gemini.google.com'));
    
    if (page) {
        console.log('✅ Aba do Gemini encontrada! Assumindo o controle...');
        await page.bringToFront(); 
    } else {
        console.log('⚠️ Aba do Gemini não encontrada. Abrindo uma nova...');
        page = await browser.newPage();
        await page.goto(URL_DO_SITE, { waitUntil: 'networkidle2' });
    }
    
    let ultimoComandoRodado = '';

    while (true) {
        try {
            await page.waitForSelector(SELETOR_COMANDO, { timeout: 5000 }).catch(() => {});
            
            // 1. Tenta ler o comando preliminar
            let comandoAtual = await lerUltimoComando(page);
            console.log(comandoAtual);
            // 2. Se achou um comando novo, ESPERA a geração terminar antes de agir
            if (comandoAtual && comandoAtual !== ultimoComandoRodado) {
                
                // Aguarda início da Geração
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Trava o script até a IA parar de gerar a resposta
                await aguardarFimDaGeracao(page);
                
                // 3. Lê novamente, pois o comando pode ter sido completado durante a espera!
                comandoAtual = await lerUltimoComando(page);

                // Dupla checagem de segurança
                if (comandoAtual === ultimoComandoRodado) continue;

                console.log(`\n======================================`);
                console.log(`🔥 Novo comando detectado e completo:\n${comandoAtual}`);
                
                let resultadoTerminal = '';

                try {
                    // Executa o comando completo
                    const { stdout, stderr } = await exec(comandoAtual);
                    resultadoTerminal = stdout || stderr; 
                } catch (erro) {
                    resultadoTerminal = `Erro na execução:\n${erro.message}`;
                }
                if (!resultadoTerminal || resultadoTerminal.length === 0) {
                    resultadoTerminal = 'Comando executado.';
                }
                console.log(`Saída capturada:\n${resultadoTerminal}`);
                console.log('📝 Inserindo o resultado no editor de texto...');

                await page.waitForSelector(SELETOR_CAIXA_TEXTO, { visible: true });
                await page.click(SELETOR_CAIXA_TEXTO);

                await page.keyboard.down('Control'); 
                await page.keyboard.press('A');
                await page.keyboard.up('Control');
                await page.keyboard.press('Backspace');

                // 1. Limpa e foca na caixa de texto desviando do Trusted Types
                await page.evaluate((seletor) => {
                    const caixaDeTexto = document.querySelector(seletor);
                    if (!caixaDeTexto) return;
                    
                    caixaDeTexto.focus();
                    
                    // Simula um "Control+A" (Selecionar tudo)
                    document.execCommand('selectAll', false, null);
                    
                    // Simula um "Delete" ou "Backspace"
                    document.execCommand('delete', false, null);
                    
                }, SELETOR_CAIXA_TEXTO);

                // 2. Definimos os parâmetros do fatiamento no Node.js
                const chunkSize = 500; // Ajuste conforme a necessidade de respiro da interface
                const tempoDeRespiro = 200; // Tempo em ms entre cada colagem

                console.log(`📝 Iniciando colagem de ${resultadoTerminal.length} caracteres em pedaços...`);

                // 3. O Loop agora roda no Node.js!
                for (let i = 0; i < resultadoTerminal.length; i += chunkSize) {
                    const chunk = resultadoTerminal.slice(i, i + chunkSize);

                    // O page.evaluate agora só faz uma coisa simples e rápida: colar um pedaço
                    await page.evaluate((seletor, pedaco) => {
                        const caixaDeTexto = document.querySelector(seletor);
                        caixaDeTexto.focus(); // Garante o foco no elemento a cada inserção
                        document.execCommand('insertText', false, pedaco);
                    }, SELETOR_CAIXA_TEXTO, chunk);

                    // Pausa no Node.js para dar tempo do navegador (Angular) atualizar a UI
                    await new Promise(resolve => setTimeout(resolve, tempoDeRespiro));
                }

                // 4. Dispara o evento de input no final para o Gemini validar o campo
                await page.evaluate((seletor) => {
                    document.querySelector(seletor).dispatchEvent(new Event('input', { bubbles: true }));
                }, SELETOR_CAIXA_TEXTO);

                console.log('✅ Texto massivo colado com sucesso!');

                // Pequeno atraso para garantir que o front-end do Gemini registrou o 'insertText'
                await new Promise(resolve => setTimeout(resolve, 5000));
                await page.keyboard.press('Enter');
                console.log('✅ Resultado enviado!');

                ultimoComandoRodado = comandoAtual;
            } else {
                console.log('⏳ Nenhum novo comando detectado.');
            }

        } catch (erro) {
            console.error(`Erro durante o ciclo: ${erro.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, TEMPO_DE_ESPERA_MS));
    }
}

iniciarBot();

// Função auxiliar para evitar repetição de código na hora de ler o DOM
async function lerUltimoComando(page) {
    return await page.$$eval(SELETOR_COMANDO, elementos => {
        if (elementos.length === 0) return null;
        return elementos[elementos.length - 1].innerText.trim();
    });
}

// Nova função baseada na verificação do botão
async function aguardarFimDaGeracao(page) {
    console.log('⏳ Detectada nova resposta. Aguardando o botão de "Stop" sumir...');

    // Damos 1 segundinho de "gordura" para garantir que a interface 
    // teve tempo de trocar o botão Play pelo botão Stop após o envio do comando.
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // O pulo do gato está aqui: { hidden: true }
        // O Puppeteer vai ficar travado nesta linha até que o elemento do botão STOP
        // seja removido do DOM ou fique invisível (display: none).
        // timeout: 0 significa que ele vai esperar para sempre se for preciso (para respostas muito longas).
        await page.waitForSelector(SELETOR_BOTAO_STOP, { hidden: true, timeout: 0 });
        
        // Damos mais um tempinho mínimo só para garantir que a tag <code> terminou de ser renderizada
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ Resposta concluída pela IA!');
    } catch (erro) {
        console.log(`⚠️ Erro ao monitorar o botão: ${erro.message}`);
    }
}