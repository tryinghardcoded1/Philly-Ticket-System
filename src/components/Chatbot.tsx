import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { MessageSquare, X, Mic, Send, MicOff, Loader2 } from 'lucide-react';
import { Rental, Ticket, Vehicle } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatbotProps {
  rentals: Rental[];
  tickets: Ticket[];
  vehicles: Vehicle[];
}

// Simple matching helper
function searchData(items: any[], term: string) {
  const lowerTerm = term.toLowerCase();
  return items.filter(item => {
    return Object.values(item).some(val => 
      val && String(val).toLowerCase().includes(lowerTerm)
    );
  }).slice(0, 10); // Limit to 10 results
}

export default function Chatbot({ rentals, tickets, vehicles }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Speech Recognition
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        handleSendMessage(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    const userMessage = typeof overrideText === 'string' ? overrideText.trim() : input.trim();
    if (!userMessage) return;

    if (typeof overrideText !== 'string') {
      setInput('');
    }
    
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

      if (!chatRef.current) {
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: "You are an operations Virtual Assistant (VA) helper for Philly Car rental. You can search rentals and tickets to help users find information, check for duplicates, or correct names. Be concise and professional.",
            tools: [{
              functionDeclarations: [
                {
                  name: 'searchRentals',
                  description: 'Search the database of car rentals. Use this to find duplicate names, check a customer status, etc.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      searchTerm: { type: Type.STRING, description: 'Customer name, email, or plate number' }
                    },
                    required: ['searchTerm']
                  }
                },
                {
                  name: 'searchTickets',
                  description: 'Search the database of traffic tickets/violations.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      searchTerm: { type: Type.STRING, description: 'Plate number or violation type' }
                    },
                    required: ['searchTerm']
                  }
                }
              ]
            }]
          },
          history: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }))
        });
      }

      let response = await chatRef.current.sendMessage({ message: userMessage });
      let text = response.text || '';

      // Handle function calling
      const calls = response.functionCalls;
      if (calls && calls.length > 0) {
        const call = calls[0];
        let apiResponse: any = {};
        
        if (call.name === 'searchRentals') {
          const args = call.args as any;
          const results = searchData(rentals, args.searchTerm || '');
          apiResponse = { results };
        } else if (call.name === 'searchTickets') {
          const args = call.args as any;
          const results = searchData(tickets, args.searchTerm || '');
          apiResponse = { results };
        }

        const response2 = await chatRef.current.sendMessage({
          message: [{
            functionResponse: {
              name: call.name,
              response: apiResponse
            }
          }]
        });
        text = response2.text || '';
      }

      setMessages(prev => [...prev, { role: 'model', text: text || 'I could not process that request.' }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please ensure your API key is configured.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const chatRef = useRef<any>(null);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 active:scale-95"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between bg-indigo-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} />
          <span className="font-semibold text-sm">VA Assistant</span>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1 hover:bg-white/20 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-4">
            <p>Hi! I can help you search rentals, checking for duplicate names, or find ticket info.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1">
              <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListen}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              isListening 
                ? 'bg-rose-100 text-rose-600 animate-pulse scale-105 shadow-inner' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            /* we can optionally clear focus or change placeholder */
            placeholder={isListening ? "Listening... Speak now" : "Ask me anything..."}
            className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            disabled={isListening}
          />
          
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isTyping || isListening}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
