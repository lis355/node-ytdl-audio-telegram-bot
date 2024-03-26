import { Telegraf } from "telegraf";

import ApplicationComponent from "./app/ApplicationComponent.js";
import AsyncQueue from "../tools/AsyncQueue.js";

const LOG_MESSAGE_LIFETIME_IN_MILLISECONDS = 10000;

export default class TelegramBot extends ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.asyncQueue = new AsyncQueue();

		this.initializeBot();

		console.log("[TelegramBot]: started");
	}

	initializeBot() {
		this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

		this.bot
			.on("message", async ctx => this.asyncQueue.push(async () => this.processTextMessage(ctx)))
			.catch((error, ctx) => {
				console.error(error);
			})
			.launch();
	}

	async processTextMessage(ctx) {
		await this.processYouTubeLink(ctx.chat.id, ctx.message.text);
	}

	async sendMessage(chatId, message) {
		const replyMessageInfo = await this.bot.telegram.sendMessage(chatId, message);

		const deleteMessage = async () => this.deleteMessage(chatId, replyMessageInfo["message_id"]);

		return deleteMessage;
	}

	async sendMessageWithAutodelete(chatId, message) {
		const deleteMessage = await this.sendMessage(chatId, message);

		setTimeout(deleteMessage, LOG_MESSAGE_LIFETIME_IN_MILLISECONDS);
	}

	async deleteMessage(chatId, messageId) {
		await this.bot.telegram.deleteMessage(chatId, messageId);
	}

	async processYouTubeLink(chatId, text) {
		try {
			const { youTubeDownloader } = this.application;

			const id = youTubeDownloader.parseYouTubeId(text);
			if (!id) await this.sendMessageWithAutodelete(chatId, "Некорректая ссылка или ID");

			const info = await youTubeDownloader.getInfo(id);
			const videoInfoString = `${info.videoDetails.author.user} ${info.videoDetails.title}`;
			const buffer = await youTubeDownloader.downloadYouTubeAudioFromVideo(info);

			await this.bot.telegram.sendDocument(chatId, {
				source: buffer,
				filename: `${info.videoDetails.title}.mp3`
			}, {
				caption: videoInfoString
			});
		} catch (error) {
			await this.sendMessageWithAutodelete(chatId, `Ошибка: ${error.message}`);
		}
	}
};
