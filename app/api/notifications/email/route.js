import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function POST(request) {
  try {
    // Verify admin access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { alerts, recipients } = await request.json();

    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return NextResponse.json({ error: 'No alerts provided' }, { status: 400 });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients provided' }, { status: 400 });
    }

    // Filter only critical and high priority alerts for email notifications
    const criticalAlerts = alerts.filter(alert => 
      alert.priority === 'critical' || alert.priority === 'high'
    );

    if (criticalAlerts.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No critical alerts to send',
        sent: 0 
      });
    }

    // Generate email content
    const emailSubject = `🚨 CUTM Analytics Alert - ${criticalAlerts.length} Critical Alert${criticalAlerts.length > 1 ? 's' : ''}`;
    
    const emailHtml = generateEmailHtml(criticalAlerts);
    const emailText = generateEmailText(criticalAlerts);

    let sentCount = 0;
    const errors = [];

    // Send emails to all recipients
    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html: emailHtml,
          text: emailText
        });
        sentCount++;
      } catch (error) {
        errors.push({
          recipient: recipient.email,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} alert emails successfully`,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error sending alert emails:', error);
    return NextResponse.json({ error: 'Failed to send alert emails' }, { status: 500 });
  }
}

function generateEmailHtml(alerts) {
  const currentTime = new Date().toLocaleString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CUTM Analytics Alert</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #dc2626, #ef4444);
          color: white;
          padding: 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: bold;
        }
        .header p {
          margin: 8px 0 0 0;
          opacity: 0.9;
        }
        .content {
          padding: 20px;
        }
        .alert {
          border-left: 4px solid #dc2626;
          background: #fef2f2;
          padding: 16px;
          margin: 16px 0;
          border-radius: 0 8px 8px 0;
        }
        .alert.high {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }
        .alert-title {
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 8px;
          font-size: 16px;
        }
        .alert.high .alert-title {
          color: #f59e0b;
        }
        .alert-message {
          color: #374151;
          margin-bottom: 8px;
        }
        .alert-time {
          font-size: 12px;
          color: #6b7280;
        }
        .footer {
          background: #f3f4f6;
          padding: 16px 20px;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
        }
        .priority-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          margin-left: 8px;
        }
        .priority-critical {
          background: #dc2626;
          color: white;
        }
        .priority-high {
          background: #f59e0b;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 CUTM Analytics Alert</h1>
          <p>Critical performance alerts require immediate attention</p>
        </div>
        
        <div class="content">
          <p><strong>Alert Summary:</strong> ${alerts.length} critical alert${alerts.length > 1 ? 's' : ''} detected in the CUTM Result Portal analytics system.</p>
          
          ${alerts.map(alert => `
            <div class="alert ${alert.priority === 'high' ? 'high' : ''}">
              <div class="alert-title">
                ${alert.category.replace('_', ' ').toUpperCase()}
                <span class="priority-badge priority-${alert.priority}">${alert.priority}</span>
              </div>
              <div class="alert-message">${alert.message}</div>
              <div class="alert-time">Detected: ${new Date(alert.timestamp).toLocaleString()}</div>
            </div>
          `).join('')}
          
          <p><strong>Recommended Actions:</strong></p>
          <ul>
            <li>Review the analytics dashboard for detailed insights</li>
            <li>Check affected departments and students</li>
            <li>Consider implementing immediate corrective measures</li>
            <li>Monitor performance trends closely</li>
          </ul>
          
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/admin/analytics" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Analytics Dashboard
            </a>
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated alert from CUTM Result Portal Analytics System</p>
          <p>Generated on ${currentTime}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateEmailText(alerts) {
  const currentTime = new Date().toLocaleString();
  
  return `
CUTM ANALYTICS ALERT - ${alerts.length} Critical Alert${alerts.length > 1 ? 's' : ''}

Critical performance alerts require immediate attention in the CUTM Result Portal analytics system.

ALERT DETAILS:
${alerts.map((alert, index) => `
${index + 1}. ${alert.category.replace('_', ' ').toUpperCase()} [${alert.priority.toUpperCase()}]
   Message: ${alert.message}
   Detected: ${new Date(alert.timestamp).toLocaleString()}
`).join('')}

RECOMMENDED ACTIONS:
- Review the analytics dashboard for detailed insights
- Check affected departments and students  
- Consider implementing immediate corrective measures
- Monitor performance trends closely

View Analytics Dashboard: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/admin/analytics

This is an automated alert from CUTM Result Portal Analytics System
Generated on ${currentTime}
  `;
}
