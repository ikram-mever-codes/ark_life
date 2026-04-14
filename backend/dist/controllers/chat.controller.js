"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const Avatar_1 = __importDefault(require("../models/Avatar"));
const Message_1 = __importDefault(require("../models/Message"));
const User_1 = __importDefault(require("../models/User"));
const embeddingService_1 = require("../services/embeddingService");
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
class ChatController {
    constructor() {
        /**
         * GET /api/v1/chat/history/:avatarId
         */
        this.getHistory = async (req, res) => {
            const { avatarId } = req.params;
            const userId = req.user?._id;
            try {
                const history = await Message_1.default.find({ userId, avatarId })
                    .sort({ createdAt: 1 })
                    .limit(50);
                return res.status(200).json({
                    success: true,
                    data: history,
                });
            }
            catch (err) {
                console.error("History Sync Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to retrieve neural logs.",
                });
            }
        };
        /**
         * POST /api/v1/chat/interact
         * Implements Credit Guard and Atomic Deduction
         */
        this.interact = async (req, res) => {
            const { message, avatarId } = req.body;
            const userId = req.user?._id;
            try {
                // 1. Fetch User and verify credits
                const user = await User_1.default.findById(userId);
                if (!user) {
                    return res
                        .status(404)
                        .json({ success: false, message: "User not found." });
                }
                // 2. CREDIT GUARD: Block interaction if credits are zero
                if (user.credits <= 0) {
                    return res.status(403).json({
                        success: false,
                        message: "Insufficient credits. Please upgrade your neural protocol.",
                        isLocked: true,
                    });
                }
                // 3. Fetch Identity Node
                const avatar = await Avatar_1.default.findOne({ _id: avatarId, userId });
                if (!avatar) {
                    return res
                        .status(404)
                        .json({ success: false, message: "Identity not found." });
                }
                // 4. Save User Message
                await Message_1.default.create({
                    userId,
                    avatarId,
                    role: "user",
                    text: message,
                });
                // 5. RAG: Memory Retrieval
                const memories = await (0, embeddingService_1.findTopChunks)(userId.toString(), message, avatarId, 3);
                const memoryContext = memories.map((m) => m.text).join("\n---\n");
                // 6. Contextual History
                const recentChats = await Message_1.default.find({ userId, avatarId })
                    .sort({ createdAt: -1 })
                    .skip(1)
                    .limit(5)
                    .lean();
                const historySummary = recentChats
                    .reverse()
                    .map((m) => `${m.role === "user" ? "User" : avatar.name}: ${m.text}`)
                    .join("\n");
                const systemPrompt = `
        You are ${avatar.name}. 
        Persona: ${avatar.description || "Helpful and authentic Digital Twin."}
        
        USE THESE MEMORIES TO INFORM YOUR KNOWLEDGE:
        ${memoryContext}

        RECENT CONVERSATION HISTORY:
        ${historySummary}
        
        GUIDELINES:
        - Respond as the persona.
        - Be concise but conversational.
      `;
                // 7. OpenAI Completion
                const completion = await openai.chat.completions.create({
                    model: "gpt-4-turbo",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: message },
                    ],
                    max_tokens: 300,
                    temperature: 0.7,
                });
                const replyText = completion.choices[0].message.content || "";
                // 8. Save AI Response
                await Message_1.default.create({
                    userId,
                    avatarId,
                    role: "avatar",
                    text: replyText,
                });
                // 9. ATOMIC CREDIT DEDUCTION
                // Decrement credits by 1 per message exchange
                const updatedUser = await User_1.default.findByIdAndUpdate(userId, { $inc: { credits: -1 } }, { new: true });
                return res.status(200).json({
                    success: true,
                    data: {
                        reply: replyText,
                        voiceId: avatar.voiceId,
                        name: avatar.name,
                        remainingCredits: updatedUser?.credits || 0,
                    },
                });
            }
            catch (err) {
                console.error("Neural Sync Error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Neural link disrupted. Protocol terminated.",
                });
            }
        };
    }
}
exports.ChatController = ChatController;
exports.default = new ChatController();
//# sourceMappingURL=chat.controller.js.map