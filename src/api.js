import express from "express";
import cors from "cors";
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- Carregando a Persona e a Mente da Nova ---
const novaPersonaPath = path.resolve(process.cwd(), 'Nova', 'nova.json');
const novaMindPath = path.resolve(process.cwd(), 'Nova', 'mind.json');

let novaPersona = {};
let novaMind = [];

async function loadAI() {
  try {
    const personaData = await fs.readFile(novaPersonaPath, 'utf-8');
    novaPersona = JSON.parse(personaData);

    const mindData = await fs.readFile(novaMindPath, 'utf-8');
    novaMind = JSON.parse(mindData);

    console.log("🧠 Mente da Nova carregada.");
    console.log(`🗣️ Persona da Nova: ${novaPersona.nome}, ${novaPersona.idade} anos.`);
  } catch (error) {
    console.error("Erro ao carregar os arquivos da IA:", error);
    // Se a mente não existir, começa com uma vazia.
    if (error.code === 'ENOENT') {
        novaMind = [];
        await fs.writeFile(novaMindPath, JSON.stringify([], null, 2));
        console.log("Arquivo mind.json não encontrado. Um novo foi criado.");
    }
  }
}

// --- CONFIGURAÇÃO DA IA GENERATIVA (GEMINI) ---
if (!process.env.GEMINI_API_KEY) {
    console.error("ERRO FATAL: A variável de ambiente GEMINI_API_KEY não foi encontrada.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

//  Rota de chat (aprendizado / interação)
app.post("/omnIA/chat", async (req, res) => {
    const { message } = req.body; 

    if (!message) {
        return res.status(400).json({ error: "Nenhuma entrada fornecida." });
    }

    try {
        // --- Lógica de "Aprendizado" ---
        // 1. Pega as últimas 10 interações para dar contexto.
        const recentHistory = novaMind.slice(-10);
        const historyForPrompt = recentHistory.map(item => 
            `User: "${item.entrada}"\nNova: "${item.answer}"`
        ).join('\n\n');

        // 2. Constrói o prompt inteligente
        const prompt = `
          Você é a Nova, uma IA com a seguinte personalidade: ${JSON.stringify(novaPersona.personalidade)}.
          Seu objetivo é: ${novaPersona.funcao_na_OmnIA.objetivo}.
          Seu criador e usuário principal se chama ${novaPersona.config.usuario}. Trate-o sempre com familiaridade e positividade.
          Seu lema é: "${novaPersona.simbolismo.lema}".

          Abaixo está um histórico recente da sua conversa com ${novaPersona.config.usuario}. Use-o para manter o contexto.
          ---
          ${historyForPrompt}
          ---

          Agora, responda à nova mensagem de ${novaPersona.config.usuario} de forma natural e seguindo sua personalidade.

          User: "${message}"
          Nova:
        `;

        // 3. Gera a resposta
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const novaAnswer = response.text();

        // 4. Salva na memória
        const newMemoryEntry = {
            data: new Date().toISOString(),
            entrada: message,
            answer: novaAnswer,
        };
        novaMind.push(newMemoryEntry);
        await fs.writeFile(novaMindPath, JSON.stringify(novaMind, null, 2));

        console.log(`[${newMemoryEntry.data}] User: ${message} | Nova: ${novaAnswer.substring(0, 50)}...`);

        // 5. Retorna a resposta para o frontend
        res.json({ answer: novaAnswer });

    } catch (error) {
        console.error("Erro ao gerar resposta:", error);
        const userName = novaPersona.config ? novaPersona.config.usuario : 'usuário';
        res.status(500).json({ error: `Uhm, ${userName}, meu cérebro deu um nó aqui. 🧠 Pode tentar de novo?` });
    }
});

// 🚀 Inicializa servidor
app.listen(PORT, async () => {
    await loadAI();
    console.log(`🚀 Servidor da OmnIA rodando na porta ${PORT}`);
});
