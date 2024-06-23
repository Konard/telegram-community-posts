const TelegramBot = require('node-telegram-bot-api');
const token = require('fs').readFileSync('token', 'utf-8').trim();
const channelUsername = 'community_posts';
const bot = new TelegramBot(token, { polling: true });

const dailyLimit = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

async function canPerformAction(lastActionTime) {
  const currentTime = Date.now();
  return !lastActionTime || currentTime - lastActionTime >= dailyLimit;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await bot.getChat(`@${channelUsername}`);
  } catch (error) {
    bot.sendMessage(chatId, `
      Канал не найден или бот не является администратором канала.
      Создайте канал и добавьте бота в качестве администратора.
      Имя канала должно быть: @${channelUsername}
    `);
    return;
  }

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
    if (!await canPerformAction(userPostTimes[userId])) {
      bot.sendMessage(msg.chat.id, "Вы можете опубликовать только одно сообщение в день.");
      return;
    }

    bot.sendMessage(msg.chat.id, "Введите текст вашего сообщения:").then(() => {
      bot.once('message', async (msg) => {
        const messageText = msg.text;

        await bot.sendMessage(`@${channelUsername}`, `${messageText}\n\n@${username}`);
        userPostTimes[userId] = Date.now();
        bot.sendMessage(msg.chat.id, "Ваше сообщение опубликовано!");
      });
    });

  } else if (action === 'lift_message') {
    const chatId = `@${channelUsername}`;
    const searchText = `@${username}`;

    try {
      const results = await bot.searchPublicChatMessages(chatId, searchText);
      const messages = results.messages || [];
      const userPost = messages.find(m => m.text.endsWith(searchText));

      if (!await canPerformAction(userLiftTimes[userId])) {
        bot.sendMessage(msg.chat.id, "Вы можете поднять своё сообщение только раз в день.");
        return;
      }

      if (!userPost) {
        bot.sendMessage(msg.chat.id, "Ваше сообщение не найдено в канале.");
        return;
      }

      bot.deleteMessage(chatId, userPost.message_id).then(() => {
        bot.sendMessage(msg.chat.id, "Введите текст вашего сообщения:").then(() => {
          bot.once('message', async (msg) => {
            const messageText = msg.text;

            await bot.sendMessage(chatId, `${messageText}\n\n@${username}`);
            userLiftTimes[userId] = Date.now();
            bot.sendMessage(msg.chat.id, "Ваше сообщение поднято!");
          });
        });
      }).catch(() => {
        bot.sendMessage(msg.chat.id, "Не удалось поднять сообщение, попробуйте позже.");
      });
    } catch (error) {
      bot.sendMessage(msg.chat.id, "Ошибка при поиске сообщения: " + error.message);
    }
  }
});