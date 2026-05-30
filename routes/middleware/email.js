const { Resend } = require('resend');

// Resend API Key — 需要在环境变量中设置
// Windows: set RESEND_API_KEY=re_xxx
// 注册地址: https://resend.com
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

let resend = null;
if (RESEND_API_KEY && RESEND_API_KEY !== 're_placeholder') {
  resend = new Resend(RESEND_API_KEY);
}

/**
 * 发送邮箱验证码
 * @param {string} toEmail - 接收方邮箱
 * @param {string} code - 6位验证码
 * @returns {object} { success, error? }
 */
async function sendVerificationCode(toEmail, code) {
  if (!resend) {
    console.warn('[Email] Resend API Key 未配置，跳过发送。验证码:', code);
    return { success: true, code }; // 开发模式下返回验证码便于调试
  }

  try {
    const { data, error } = await resend.emails.send({
      from: '课搭子 <noreply@kedazi.app>',
      to: [toEmail],
      subject: '课搭子 - 邮箱验证码',
      html: `
        <div style="max-width:480px;margin:0 auto;padding:32px;font-family:sans-serif">
          <h2 style="color:#333">课搭子 邮箱验证</h2>
          <p>你的验证码是：</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a73e8">${code}</span>
          </div>
          <p style="color:#888;font-size:14px">验证码 10 分钟内有效。如果这不是你的操作，请忽略此邮件。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#aaa;font-size:12px">课搭子 · 同课程学习互助平台</p>
        </div>
      `
    });

    if (error) {
      console.error('[Email] 发送失败:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] 验证码已发送至', toEmail);
    return { success: true };
  } catch (e) {
    console.error('[Email] 发送异常:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { sendVerificationCode };
