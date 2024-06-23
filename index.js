const TelegramBot = require('node-telegram-bot-api');
const token = require('fs').readFileSync('token', 'utf-8').trim();
const bot = new TelegramBot(token, { polling: true });

const dailyLimit = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

function canPerformAction(lastActionTime) {
  const currentTime = Date.now();
  return !lastActionTime || currentTime - lastActionTime >= dailyLimit;
}

async function findUserPost(channelUsername, username) {
  const chatId = `@${channelUsername}`;
  const searchText = `Автор: @${username}`;

  try {
    const results = await bot.searchPublicChatMessages(chatId, searchText);
    const messages = results.messages || [];
    return messages.find(msg => msg.text.includes(searchText));
  } catch (error) {
    console.error('Error finding user post:', error);
    return null;
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Опубликовать сообщение',
          callback_data: 'post_message'
        }],
        [{
          text: 'Поднять сообщение',
          callback_data: 'lift_message'
        }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Выберите действие:', opts);
});

bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username;

  // Placeholder objects for storing user action times
  const userPostTimes = {};  
  const userLiftTimes = {};  

  if (action === 'post_message') {
    if (!canPerformAction(userPostTimes[userId])) {
      bot.sendMessage(msg.chat.id, "Вы можете опубликовать только одно сообщение в день.");
      return;
    }

    bot.sendMessage(msg.chat.id, "Введите текст вашего сообщения:").then(() => {
      bot.once('message', async (msg) => {
        const messageText = msg.text;

        await bot.sendMessage('@YOUR_CHANNEL_USERNAME', `${messageText}\n\nАвтор: @${username}`);
        userPostTimes[userId] = Date.now();
        bot.sendMessage(msg.chat.id, "Ваше сообщение опубликовано!");
      });
    });

  } else if (action === 'lift_message') {
    if (!canPerformAction(userLiftTimes[userId])) {
      bot.sendMessage(msg.chat.id, "Вы можете поднять своё сообщение только раз в день.");
      return;
    }

    const userPost = await findUserPost('YOUR_CHANNEL_USERNAME', username);

    if (!userPost) {
      bot.sendMessage(msg.chat.id, "Ваше сообщение не найдено в канале.");
      return;
    }

    bot.deleteMessage('@YOUR_CHANNEL_USERNAME', userPost.message_id).then(() => {
      bot.sendMessage(msg.chat.id, "Введите текст вашего сообщения:").then(() => {
        bot.once('message', async (msg) => {
          const messageText = msg.text;

          await bot.sendMessage('@YOUR_CHANNEL_USERNAME', `${messageText}\n\nАвтор: @${username}`);
          userLiftTimes[userId] = Date.now();
          bot.sendMessage(msg.chat.id, "Ваше сообщение поднято!");
        });
      });
    }).catch(() => {
      bot.sendMessage(msg.chat.id, "Не удалось поднять сообщение, попробуйте позже.");
    });
  }
});