/**
 * Africa's Talking SDK Configuration
 * 
 * This is optional - only needed if you want to:
 * - Send SMS notifications
 * - Make voice calls
 * - Send airtime
 * - Use other Africa's Talking services
 * 
 * For USSD, you DON'T need this!
 * Africa's Talking calls your endpoint directly.
 */

// Uncomment if you install the SDK: npm install africastalking
import AfricasTalking from 'africastalking';

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY || 'test',
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
});

export const sms = africastalking.SMS;

export default africastalking;

// For now, just export a placeholder
export const africastalkingConfig = {
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
  // API key is available but not exposed
  isConfigured: !!(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME)
};
