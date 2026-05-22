const wsUrl = "ws://localhost:9222/devtools/page/B7805861EE770CA4404580AB2771E26D";

console.log(`Connecting to Chrome at ${wsUrl}...`);
const ws = new WebSocket(wsUrl);

let msgId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = msgId++;
  const payload = JSON.stringify({ id, method, params });
  ws.send(payload);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

ws.onopen = async () => {
  try {
    console.log("WebSocket connected. Enabling Runtime...");
    await send("Runtime.enable");

    console.log("Evaluating page title...");
    const titleResult = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
    console.log("Page Title:", titleResult.result.value);

    console.log("Locating input element and sending regression test message...");
    const testScript = `
      (function() {
        const textarea = document.querySelector('textarea') || document.querySelector('input[type="text"]');
        if (!textarea) return "Error: Input element not found";
        
        textarea.value = "回归测试：后端与IM联动已成功解决！系统功能稳定。";
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Find send button
        const buttons = Array.from(document.querySelectorAll('button'));
        const sendBtn = buttons.find(b => b.textContent.includes('发送') || b.className.includes('send'));
        if (sendBtn) {
          sendBtn.click();
          return "Clicked send button successfully";
        } else {
          // Fallback: press Enter key on textarea
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          textarea.dispatchEvent(enterEvent);
          return "Dispatched Enter key event";
        }
      })()
    `;

    const sendResult = await send("Runtime.evaluate", { expression: testScript, returnByValue: true });
    console.log("Send Message Result:", sendResult.result.value);

    // Wait 3 seconds for the message to be sent and any network requests to complete
    console.log("Waiting 3 seconds for message delivery...");
    await new Promise(r => setTimeout(r, 3000));

    console.log("Evaluating the last few messages in the chat area...");
    const chatScript = `
      (function() {
        const bubbles = Array.from(document.querySelectorAll('.bubble, .text-cell, .message-cell'));
        return bubbles.slice(-3).map(b => b.textContent.trim());
      })()
    `;
    const chatResult = await send("Runtime.evaluate", { expression: chatScript, returnByValue: true });
    console.log("Last messages:", chatResult.result.value);

    console.log("Testing Switch Tab to Contacts...");
    const switchTabScript = `
      (function() {
        // Find Contacts tab sidebar icon/button (e.g. element containing '联系人' or second sidebar item)
        const items = Array.from(document.querySelectorAll('.sidebar-item, .menu-item, a, button, div'));
        const contactsTab = items.find(i => i.textContent.includes('联系人') || i.className.includes('contacts'));
        if (contactsTab) {
          contactsTab.click();
          return "Clicked Contacts tab";
        }
        return "Contacts tab not found";
      })()
    `;
    const switchResult = await send("Runtime.evaluate", { expression: switchTabScript, returnByValue: true });
    console.log("Switch Tab Result:", switchResult.result.value);

    await new Promise(r => setTimeout(r, 2000));

    console.log("Verifying if contact list contains any items...");
    const contactsVerifyScript = `
      (function() {
        const contactItems = Array.from(document.querySelectorAll('.contact-item, .user-item, .friend-item'));
        return {
          count: contactItems.length,
          names: contactItems.slice(0, 5).map(c => c.textContent.trim())
        };
      })()
    `;
    const contactsVerifyResult = await send("Runtime.evaluate", { expression: contactsVerifyScript, returnByValue: true });
    console.log("Contacts count & list:", contactsVerifyResult.result.value);

    // Switch back to Chat Tab
    console.log("Switching back to Chats...");
    const switchChatsScript = `
      (function() {
        const items = Array.from(document.querySelectorAll('.sidebar-item, .menu-item, a, button, div'));
        const chatsTab = items.find(i => i.textContent.includes('会话') || i.className.includes('chats') || i.className.includes('message'));
        if (chatsTab) {
          chatsTab.click();
          return "Clicked Chats tab";
        }
        return "Chats tab not found";
      })()
    `;
    await send("Runtime.evaluate", { expression: switchChatsScript, returnByValue: true });
    await new Promise(r => setTimeout(r, 1000));

    console.log("Capture current logs or errors in window...");
    const errorsResult = await send("Runtime.evaluate", { expression: "window.__errors || []", returnByValue: true });
    console.log("Window Errors:", errorsResult.result.value);

    console.log("Regression test complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error during regression test:", err);
    process.exit(1);
  }
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) {
      reject(data.error);
    } else {
      resolve(data.result);
    }
  }
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
  process.exit(1);
};
