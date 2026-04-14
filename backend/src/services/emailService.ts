import nodemailer from "nodemailer";

interface EmailOptions {
  from?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    secure: true,
    port: 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // ⚠️ Only use this in development!
      rejectUnauthorized: false,
    },
  });
};

const sendEmail = async (options: EmailOptions) => {
  const transporter = createTransporter();

  try {
    // Use a proper from format with name and email
    const fromAddress = options.from || `"ArkLife" <${process.env.EMAIL_USER}>`;

    const mailOptions = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      headers: {
        "X-Priority": "3",
        "X-Mailer": "Your App",
        ...options.headers,
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", options.to);
    console.log("Message ID:", info.messageId);

    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email. Please try again.");
  }
};

export default sendEmail;
