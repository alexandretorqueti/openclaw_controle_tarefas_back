const puppeteer = require('puppeteer');
const util = require('util');
const exec = util.promisify(require('child_process').exec); // Permite usar async/await no exec

// Novas Configurações
const URL_DO_SITE = 'https://gemini.google.com/'; 
const SELETOR_COMANDO = 'code'; // Pega o código isolado do Angular
const SELETOR_CAIXA_TEXTO = '.ql-editor'; // Pega o editor de texto rico
const TEMPO_DE_ESPERA_MS = 5000;

async function iniciarBot() {
    console.log('🤖 Iniciando o bot...');
    
    // Abre o navegador. Mude headless para false se quiser ver o robô trabalhando
    console.log('🔗 Conectando ao seu Chrome pessoal...');
    
    // Conecta na porta 9222 do Chrome que você abriu pelo terminal do Pop!_OS
    const browser = await puppeteer.connect({ 
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: null // Isso evita que o Puppeteer esmague o tamanho da sua janela
    });
    
    // Lista todas as abas que já estão abertas nesse Chrome
    const abasAbertas = await browser.pages();
    
    // Procura se você já tem uma aba do Gemini aberta
    let page = abasAbertas.find(aba => aba.url().includes('gemini.google.com'));
    
    if (page) {
        console.log('✅ Aba do Gemini encontrada! Assumindo o controle...');
        await page.bringToFront(); // Puxa a aba pro foco
    } else {
        console.log('⚠️ Aba do Gemini não encontrada. Abrindo uma nova...');
        page = await browser.newPage();
        await page.goto(URL_DO_SITE, { waitUntil: 'networkidle2' });
    }
    let ultimoComandoRodado = '';

    // Loop infinito para ficar verificando o site continuamente
    while (true) {
        try {
            // 1. Tenta ler o comando do site
            // Aguarda o elemento existir na tela antes de tentar ler
            await page.waitForSelector(SELETOR_COMANDO, { timeout: 5000 }).catch(() => {});
            
            // Usamos $$eval (dois cifrões) para pegar TODOS os elementos que deram match
            const comandoAtual = await page.$$eval(SELETOR_COMANDO, elementos => {
                if (elementos.length === 0) return null; // Se não achou nada, retorna null
                
                // Pega o último elemento da lista
                const ultimoElemento = elementos[elementos.length - 1];
                return ultimoElemento.innerText.trim();
            });

            // 2. Verifica se é um comando válido e se já não foi rodado
            if (comandoAtual && comandoAtual !== ultimoComandoRodado) {
                console.log(`\n======================================`);
                console.log(`🔥 Novo comando detectado: ${comandoAtual}`);
                
                let resultadoTerminal = '';

                // 3. Executa o comando no terminal
                try {
                    const { stdout, stderr } = await exec(comandoAtual);
                    resultadoTerminal = stdout || stderr; // Pega a saída (sucesso ou erro)
                } catch (erro) {
                    resultadoTerminal = `Erro na execução:\n${erro.message}`;
                }

                console.log(`Saída capturada:\n${resultadoTerminal}`);

                // --- COLE ESTA NOVA PARTE NO LUGAR ---
                console.log('📝 Inserindo o resultado no editor de texto...');

                // 4. Aguarda a caixa de texto existir e foca nela
                await page.waitForSelector(SELETOR_CAIXA_TEXTO, { visible: true });
                await page.click(SELETOR_CAIXA_TEXTO);

                // 5. Limpa qualquer texto antigo (Simula Ctrl+A e Backspace)
                await page.keyboard.down('Control'); // No Mac, troque 'Control' por 'Meta' se der erro
                await page.keyboard.press('A');
                await page.keyboard.up('Control');
                await page.keyboard.press('Backspace');

                // 6. Cola o resultado instantaneamente (Truque do execCommand)
                await page.evaluate((seletor, texto) => {
                    const caixaDeTexto = document.querySelector(seletor);
                    caixaDeTexto.focus();
                    document.execCommand('insertText', false, texto);
                }, SELETOR_CAIXA_TEXTO, resultadoTerminal);

                // 7. Pequeno atraso pro site processar e aperta Enter para enviar
                await new Promise(resolve => setTimeout(resolve, 5000));
                await page.keyboard.press('Enter');
                console.log('✅ Resultado enviado!');
                // -------------------------------------

                // Atualiza a memória do bot
                ultimoComandoRodado = comandoAtual;
            }

        } catch (erro) {
            console.error(`Erro durante o ciclo: ${erro.message}`);
        }

        // 6. Aguarda o tempo definido antes de checar novamente
        await new Promise(resolve => setTimeout(resolve, TEMPO_DE_ESPERA_MS));
    }
}

// Executa a função
iniciarBot();