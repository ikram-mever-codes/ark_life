"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWelcomeEmailTemplate = exports.getOTPEmailTemplate = exports.getVerificationEmailTemplate = void 0;
// utils/emailTemplates.ts
const getVerificationEmailTemplate = (firstName, verificationLink) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f7;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #0a0f19 0%, #1a1f2e 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
          background-color: #ffffff;
        }
        .verification-button {
          display: inline-block;
          background: linear-gradient(135deg, #0a0f19 0%, #1a1f2e 100%);
          color: #ffffff !important;
          text-decoration: none;
          padding: 15px 40px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(10, 15, 25, 0.2);
        }
        .footer {
          background-color: #f8f9fc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          margin: 5px 0;
          color: #6c757d;
          font-size: 14px;
        }
        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e9ecef, transparent);
          margin: 30px 0;
        }
        .link-fallback {
          color: #0a0f19;
          word-break: break-all;
          font-size: 14px;
          background-color: #f8f9fc;
          padding: 10px;
          border-radius: 6px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ArkLife ✦</h1>
        </div>
        
        <div class="content">
          <h2 style="margin-top: 0; color: #0a0f19;">Hello ${firstName},</h2>
          
          <p style="font-size: 16px; color: #495057;">
            Thank you for creating an account with ArkLife! We're excited to have you on board as we build the future of digital legacy together.
          </p>
          
          <p style="font-size: 16px; color: #495057;">
            Please verify your email address to activate your account and start exploring all the features we have to offer.
          </p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="verification-button">
              Verify Email Address
            </a>
          </div>
          
          <div class="divider"></div>
          
          <p style="font-size: 14px; color: #868e96;">
            If the button above doesn't work, copy and paste this link into your browser:
          </p>
          
          <div class="link-fallback">
            <a href="${verificationLink}" style="color: #0a0f19; text-decoration: none;">
              ${verificationLink}
            </a>
          </div>
          
          <p style="font-size: 14px; color: #868e96; margin-top: 30px;">
            This verification link will expire in 24 hours.
          </p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} ArkLife. All rights reserved.</p>
          <p>Building the future of digital legacy, one soul at a time.</p>
          <p style="font-size: 12px; margin-top: 20px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};
exports.getVerificationEmailTemplate = getVerificationEmailTemplate;
const getOTPEmailTemplate = (firstName, otp) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Verification Code - ArkLife</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f7;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #0a0f19 0%, #1a1f2e 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 40px 30px;
        }
        .otp-box {
          background: linear-gradient(135deg, #0a0f19 0%, #1a1f2e 100%);
          color: #ffffff;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 8px;
          padding: 20px 30px;
          border-radius: 8px;
          text-align: center;
          margin: 24px 0;
        }
        .footer {
          background-color: #f8f9fc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email - ArkLife</h1>
        </div>
        <div class="content">
          <h2 style="margin-top: 0; color: #0a0f19;">Hello ${firstName},</h2>
          <p style="font-size: 16px; color: #495057;">
            Use the following code to verify your email address:
          </p>
          <div class="otp-box">${otp}</div>
          <p style="font-size: 14px; color: #868e96;">
            This code will expire in 10 minutes. If you didn't request this, please ignore this email.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ArkLife. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
exports.getOTPEmailTemplate = getOTPEmailTemplate;
const getWelcomeEmailTemplate = (firstName) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ArkLife</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f7;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #0a0f19 0%, #1a1f2e 100%);
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 40px 30px;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 30px 0;
        }
        .feature-item {
          text-align: center;
          padding: 20px;
          background-color: #f8f9fc;
          border-radius: 8px;
        }
        .footer {
          background-color: #f8f9fc;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome Aboard, ${firstName}! 🚀</h1>
        </div>
        
        <div class="content">
          <p style="font-size: 16px;">Your email has been successfully verified!</p>
          
          <div class="feature-grid">
            <div class="feature-item">
              <div style="font-size: 24px; margin-bottom: 10px;">✨</div>
              <h3 style="margin: 0 0 5px 0;">Universal Avatars</h3>
              <p style="margin: 0; font-size: 14px;">Deploy anywhere</p>
            </div>
            <div class="feature-item">
              <div style="font-size: 24px; margin-bottom: 10px;">🔐</div>
              <h3 style="margin: 0 0 5px 0;">Neural Sovereignty</h3>
              <p style="margin: 0; font-size: 14px;">Own your data</p>
            </div>
          </div>
          
          <p>Get started by exploring your dashboard and setting up your profile.</p>
        </div>
        
        <div class="footer">
          <p>Welcome to the future of digital legacy.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
exports.getWelcomeEmailTemplate = getWelcomeEmailTemplate;
//# sourceMappingURL=emailTemplates.js.map