import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Yapılandırma - Environment variables'dan al
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Bot ve AI istemcilerini başlat
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Her kullanıcı için sohbet geçmişini sakla
const conversationHistory = new Map();

// Kullanıcı için sohbet geçmişini al veya oluştur
function getConversationHistory(chatId) {
  if (!conversationHistory.has(chatId)) {
    conversationHistory.set(chatId, []);
  }
  return conversationHistory.get(chatId);
}

// Sohbet geçmişini temizle
function clearConversationHistory(chatId) {
  conversationHistory.set(chatId, []);
}

// Gemini'den yanıt al
async function getGeminiResponse(chatId, userMessage) {
  try {
    // gemini-2.5-flash modelini kullan (en yeni ve hızlı model)
    const model = genAI.getGenerativeModel({ 
      model: 'models/gemini-2.5-flash'
    });

    const history = getConversationHistory(chatId);
    
    // Geçmişi birleştir
    let fullPrompt = '';
    if (history.length > 0) {
      // Son 10 mesajı al
      const recentHistory = history.slice(-10);
      recentHistory.forEach(msg => {
        fullPrompt += `${msg.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${msg.content}\n\n`;
      });
    }
    fullPrompt += `Kullanıcı: ${userMessage}\n\nAsistan:`;

    // İçerik üret
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    // Geçmişe ekle
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: text });

    // Son 20 mesajı tut
    if (history.length > 20) {
      conversationHistory.set(chatId, history.slice(-20));
    }

    return text;

  } catch (error) {
    console.error('Gemini API hatası:', error);
    console.error('Hata detayları:', error.message);
    
    // API key kontrolü
    if (error.message && error.message.includes('API_KEY')) {
      return '❌ API anahtarı geçersiz.\n\nYeni API key alın:\nhttps://aistudio.google.com/app/apikey';
    }
    
    if (error.message && error.message.includes('quota')) {
      return '⚠️ API kullanım limitine ulaşıldı. Lütfen birkaç dakika bekleyin.';
    }

    if (error.message && error.message.includes('SAFETY')) {
      return '⚠️ Güvenlik filtreleri nedeniyle bu içerik üretilemedi. Lütfen farklı bir soru sorun.';
    }
    
    return '❌ Bir hata oluştu. Lütfen /clear komutu ile yeniden başlayın veya tekrar deneyin.';
  }
}

// /start komutu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `Merhaba! 👋\n\nBen Google Gemini 2.5 Flash AI ile çalışan bir sohbet botuyum. Benimle her konuda sohbet edebilirsiniz!\n\n✨ Özellikler:\n• En yeni Gemini 2.5 modeli\n• Akıllı ve doğal konuşma\n• Sohbet geçmişini hatırlama\n• Türkçe tam destek\n• Hızlı yanıtlar\n\n📋 Komutlar:\n/start - Botu başlat\n/clear - Sohbet geçmişini temizle\n/help - Yardım\n/test - API bağlantısını test et`;
  
  bot.sendMessage(chatId, welcomeMessage);
});

// /clear komutu
bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  clearConversationHistory(chatId);
  bot.sendMessage(chatId, '✅ Sohbet geçmişi temizlendi! Yeni bir konuşma başlayabilirsiniz.');
});

// /test komutu - API test et
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId, '🔄 API bağlantısı test ediliyor...');
  
  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
    const result = await model.generateContent('Merhaba! Sadece "Test başarılı! Gemini 2.5 Flash çalışıyor." diye cevap ver.');
    const response = result.response;
    const text = response.text();
    await bot.sendMessage(chatId, '✅ API başarıyla çalışıyor!\n\n' + text);
  } catch (error) {
    let errorMsg = '❌ API testi başarısız!\n\n';
    errorMsg += `Hata: ${error.message}\n\n`;
    errorMsg += '🔑 Kontrol:\n';
    errorMsg += '1. API key doğru mu?\n';
    errorMsg += '2. https://aistudio.google.com/app/apikey\n';
    errorMsg += '3. Yeni key oluşturun';
    await bot.sendMessage(chatId, errorMsg);
    console.error('Test hatası:', error);
  }
});

// /help komutu
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `📚 Yardım\n\nBu bot Google Gemini 2.5 Flash AI kullanarak sizinle akıllıca sohbet eder.\n\n🤖 Yetenekler:\n• Sorularınızı yanıtlama\n• Kod yazma ve açıklama\n• Yaratıcı içerik üretme\n• Genel bilgi ve öneriler\n• Türkçe ve çoklu dil desteği\n• Hızlı ve akıllı yanıtlar\n\n⌨️ Komutlar:\n/start - Botu başlat\n/test - API bağlantısını test et\n/clear - Sohbet geçmişini sıfırla\n/help - Bu yardım mesajı\n\n💡 İpucu: Doğrudan mesaj yazarak benimle sohbet edebilirsiniz!`;
  
  bot.sendMessage(chatId, helpMessage);
});

// Normal mesajları işle
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // Komutları atla
  if (messageText && messageText.startsWith('/')) {
    return;
  }

  // Mesaj yoksa atla
  if (!messageText) {
    return;
  }

  try {
    // "Yazıyor..." göster
    await bot.sendChatAction(chatId, 'typing');

    // Gemini'den yanıt al
    const response = await getGeminiResponse(chatId, messageText);

    // Yanıtı gönder (Telegram mesaj limiti 4096 karakter)
    if (response.length > 4096) {
      const chunks = response.match(/[\s\S]{1,4096}/g) || [];
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk);
      }
    } else {
      await bot.sendMessage(chatId, response);
    }
  } catch (error) {
    console.error('Mesaj işleme hatası:', error);
    await bot.sendMessage(chatId, '❌ Mesajınızı işlerken bir hata oluştu. Lütfen tekrar deneyin.');
  }
});

// Hata yönetimi
bot.on('polling_error', (error) => {
  console.error('Polling hatası:', error);
});

console.log('🤖 Telegram AI Bot (Gemini 2.5 Flash) başlatıldı!');
console.log('✅ Bot hazır ve mesajları bekliyor...');
console.log('📝 Model: Gemini 2.5 Flash (En yeni ve hızlı model)');