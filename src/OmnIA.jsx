import React, { useState, useEffect, useRef } from 'react';
import './OmnIA.css'
import novaConfig from '../Nova/nova.json';
import ShinyText from './components/ShinyText/ShinyText'
import BlurText from './components/BlurText/BlurText';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TypingBubble from './components/TypingBubble/TypingBubble';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 

function OmnIA() {

  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    // Rola para a última mensagem quando o histórico de chat é atualizado
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  const handleSendMessage = async () => {
    if (message.trim() === '' || isLoading) return;

    const userMessage = {
      sender: 'user',
      text: message,
    };

    // Adiciona a mensagem do usuário ao histórico
    setChatHistory(prevChat => [...prevChat, userMessage]);
    const currentMessage = message;
    setMessage(''); // Limpa o textarea
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/omnIA/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentMessage }),
      });

      if (!response.ok) {
        throw new Error('A resposta da rede não foi ok.');
      }

      const data = await response.json();

      setIsLoading(false);
      const novaMessage = {
        sender: 'nova',
        text: data.answer, // Assumindo que o backend retorna um JSON com a chave "answer"
      };

      // Adiciona a resposta da Nova ao histórico
      setChatHistory(prevChat => [...prevChat, novaMessage]);

    } catch (error) {
      setIsLoading(false);
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = {
        sender: 'nova',
        text: 'Desculpe, Kley. Parece que estou com problemas para me conectar. Pode tentar novamente?',
      };
      setChatHistory(prevChat => [...prevChat, errorMessage]);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };


  return (
    <>
      <div className='header-container'>
        <div className='header-text'>
          <ShinyText
            text="OmnIA"
            disabled={false}
            speed={2}
            className='header-nova'
          />
        </div>
      </div>

      <section className={`main-container ${chatHistory.length === 0 ? 'initial-layout' : ''}`}>
        <div className={`description-container ${chatHistory.length > 0 ? 'hidden' : ''}`}>
          <BlurText
            text="OmnIA, sua companheira virtual agora de cara nova."
            delay={220}
            animateBy="words"
            direction="top"
            className="text-2xl mb-8"
          />

          <ShinyText
            text="Pergunte algo para a Nova."
            disabled={false}
            speed={3}
            className='custom-class'
          />
        </div>

        <div className="chat-display" ref={chatContainerRef}>
          {chatHistory.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.sender}`}>
              {msg.sender === 'nova' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              ) : (
                <p dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }} />
              )}
            </div>
          ))}
          {isLoading && (
            <div className="message-bubble nova">
              <TypingBubble /> 
              
              <ShinyText
            text="A nova está digitando..."
            disabled={false}
            speed={1}
            className='typing-text'
          />
            </div>
          )}
        </div>


        <div className='chat-container'>
          <div className='chat-box'>

            <textarea 
            className='omnia-chatbox' 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "Aguarde a Nova responder..." : "Pergunte alguma coisa"}
            disabled={isLoading}
            name="chatbox" 
            id="chatbox" 
            cols="30" 
            rows="2" />
            <button className='omnia-button' onClick={handleSendMessage} disabled={isLoading}>
              <SendOutlinedIcon className='omnia-send-icon' style={{ width: '30px', height: '30px', color: 'rgba(0, 0, 0, 0.74)' }} />
            </button>

          </div>
        </div>
      </section>

    </>
  )
}

export default OmnIA;
