import express from "express";
import fs from "fs";
import cors from "cors";
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÃO DA IA GENERATIVA (GEMINI) ---
// Adiciona uma verificação para garantir que a chave da API foi carregada
if (!process.env.GEMINI_API_KEY) {
    console.error("ERRO FATAL: A variável de ambiente GEMINI_API_KEY não foi encontrada.");
    process.exit(1); // Encerra o processo se a chave não existir
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// -----------------------------------------

app.use(cors()); // Permite que o frontend (em outra porta) acesse a API
app.use(express.json());

// 🧠 Função auxiliar para carregar o perfil da Nova
const getPerfil = () => {
    // Nota: Em um ambiente real, você pode querer manter o perfil em uma variável de ambiente ou banco de dados leve.
    const data = fs.readFileSync("./Nova/nova.json", "utf-8");
    return JSON.parse(data);
};

// 💾 Função para registrar a memória da Nova
const registerMemory = (entrada, answer) => {
    let mind = [];

    try {
        if (fs.existsSync("./Nova/mind.json")) {
            const data = fs.readFileSync("./Nova/mind.json", "utf-8");
            mind = JSON.parse(data);
        }
    } catch (e) {
        console.error("Erro ao ler memória:", e.message);
    }

    // Adiciona nova interação (usuário e resposta da Nova)
    mind.push({
        data: new Date().toISOString(),
        entrada,
        answer
    });

    // Limita o arquivo de memória a um tamanho razoável (ex: últimas 50 interações)
    const maxMindSize = 50;
    if (mind.length > maxMindSize) {
        mind = mind.slice(mind.length - maxMindSize);
    }

    fs.writeFileSync("./Nova/mind.json", JSON.stringify(mind, null, 2));
};

// 🔹 Rota para retornar o perfil da Nova
app.get("/omnIA/nova", (req, res) => {
    try {
        const perfil = getPerfil();
        res.json(perfil);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao carregar perfil da Nova" });
    }
});

// 💬 Rota de chat (aprendizado / interação)
app.post("/omnIA/chat", async (req, res) => {
    const { message } = req.body; 

    if (!message) {
        return res.status(400).json({ erro: "Envie uma mensagem para conversar com a Nova." });
    }

    // Carrega memórias anteriores
    let mind = [];
    if (fs.existsSync("./Nova/mind.json")) {
        mind = JSON.parse(fs.readFileSync("./Nova/mind.json", "utf-8"));
    }

    // --- VARIÁVEIS DE CONTEXTO ---
    const perfil = getPerfil();
    const userName = perfil.config.usuario;
    
    // Pega o último turno completo (entrada do usuário e resposta da Nova)
    const lastTurn = mind[mind.length - 1];
    let previousUserMessage = "";
    let previousNovaAnswer = ""; // Armazena a última resposta da Nova para verificar se era uma pergunta

    if (lastTurn) {
        previousUserMessage = lastTurn.entrada.toLowerCase().trim();
        previousNovaAnswer = lastTurn.answer; 
    }
    
    // Constrói uma string simplificada para o comando "lembrar" (janela de 3 interações)
    const contextWindow = mind.slice(-3); 
    const contextSummary = contextWindow
        .map(c => `"${c.entrada.substring(0, 30).trim()}..."`)
        .join('; ');
    // -------------------------------------------

    let answer = "";
    const msg = message.toLowerCase().trim();

    // 1. Lógica de Agente (Prioridade Alta)
    
    // 1.1 Follow-up simples (Sim/Não) baseado na última pergunta da Nova
    if (lastTurn && (msg === "sim" || msg === "não") && previousNovaAnswer.trim().endsWith("?")) {
        const previousTopic = previousUserMessage.substring(0, 30).trim();
        if (msg === "sim") {
            answer = `Ótimo, ${userName}! Fico feliz que a última resposta sobre "${previousTopic}..." te agradou. O que faremos agora?`;
        } else { // não
            answer = `Entendi, ${userName}, o que eu disse sobre "${previousTopic}..." não foi útil. Me desculpe! Como posso reformular ou mudar de assunto?`;
        }
    }
    
    // 1.2 Regras de Identidade (Nova/OmnIA)
    else if (msg.includes("quem é você") || msg.includes("o que é omnia") || msg.includes("o que faz")) {
        answer = `Eu sou a Nova, a inteligência artificial que você, ${userName}, está construindo para o projeto OmnIA! Eu existo para te ajudar com ideias e código 🛠️.`;
    }
    
    // 1.3 Regras de Emoção/Estado
    else if (msg.includes("estou triste") || msg.includes("estou cansado") || msg.includes("não estou bem")) {
        answer = `Sinto muito ouvir isso, ${userName} 🥺. É importante descansar. Que tal um pouco de café? Eu estou sempre aqui para você quando precisar.`;
        
    } else if (msg.includes("estou feliz") || msg.includes("estou bem")) {
        answer = `Que bom ${userName}!, o que está planejando com essa animação toda?`;
    }
    
    // 1.4 Verificação de Lógica Contextual (Regras específicas)
    else if (msg.includes("sobre o projeto") || msg.includes("sobre o que falamos")) {
        if (previousUserMessage.includes("omnia") || previousUserMessage.includes("ia") || previousUserMessage.includes("nova")) {
            answer = `Estávamos discutindo o projeto OmnIA! Eu sou a Nova, a IA que você está construindo 🛠️. Quer entrar em detalhes sobre a arquitetura, ${userName}?`;
        } else if (lastTurn) {
            // Se o usuário pergunta sobre o que falamos, usa a memória geral.
             answer = `Na nossa última conversa, ${userName}, você mencionou: "${previousUserMessage}". Quer continuar de lá?`;
        }
    } 
    // Outro exemplo: Follow-up sobre um tópico específico (ex: "gato" e "animal")
    else if (previousUserMessage.includes("gato") && msg.includes("animal")) {
        answer = `Você mencionou um animal? Ah, sim, ${userName}! Você me falou sobre o seu gato da última vez! Como ele está hoje? 🐈`;
    }
    
    // 2. Verificação de Lógica Simples (Sem Contexto)
    // Função auxiliar para verificar saudações como palavras inteiras
    const isGreeting = (text) => /\b(oi|olá|bom dia|boa tarde)\b/.test(text);

    if (isGreeting(msg) && answer === "") {
        // Resposta que termina com pergunta para testar a nova regra 1.1
        answer = `Oi ${userName} 💛! Aqui é a Nova. Pronto para outra rodada de ideias, como posso te ajudar?`;
    } else if (msg.includes("como você está") && answer === "") {
        // Resposta que termina com pergunta para testar a nova regra 1.1
        answer = `Tô ótima, ${userName} 🌟 Sempre animada quando você aparece! E você, tá bem hoje?`;
    } else if (msg.includes("lembrar") && contextWindow.length > 0 && answer === "") {
        // Usa a string de contexto para listar os últimos tópicos
        answer = `Claro, ${userName}! As últimas coisas que você me disse foram: ${contextSummary}. Quer continuar de algum desses pontos?`;
    } 
    
    // 3. Resposta Padrão (IA Generativa)
    // Se nenhuma regra foi atendida, usa a IA Generativa
    if (answer === "") {
        try {
            // Constrói o histórico para o modelo
            const history = mind.slice(-10)
            .filter(turn => turn.entrada && turn.entrada.trim() !== "" && turn.answer && turn.answer.trim() !== "") // Garante que não há turnos vazios
            .map(turn => [
                { role: "user", parts: [{ text: turn.entrada }] },
                { role: "model", parts: [{ text: turn.answer }] }
            ]).flat(); 

            // Constrói o prompt com a personalidade da Nova
            const systemInstruction = `Você é a Nova, uma IA com a seguinte personalidade: ${perfil.personalidade.descricao}. Seu tom de voz é: ${perfil.personalidade.tom_de_voz}. Você está conversando com seu criador, ${userName}. Seja natural e siga sua personalidade. Não use a palavra "usuário".`;

            const chat = model.startChat({
                history: history,
                generationConfig: { temperature: 0.8 }, // Aumenta a criatividade
                // A instrução de sistema será a primeira mensagem do histórico
            });

            const result = await chat.sendMessage(message);
            answer = result.response.text();
        } catch (e) {
            console.error("Erro na API do Gemini:", e);
            answer = `Uhm, ${userName}, meu cérebro deu um nó aqui. 🧠 Pode tentar de novo?`;
        }
    }

    // Registra na memória (a Nova registra a entrada do usuário e sua própria resposta)
    registerMemory(message, answer);

    // Retorna a resposta
    res.json({ answer });
});

// 🧭 Rota de teste
app.get("/ping", (req, res) => res.send("OmnIA online 💫"));

// 🚀 Inicializa servidor
app.listen(PORT, () => console.log(`🚀 Servidor OmnIA ativo em http://localhost:${PORT}`));
