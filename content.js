window.addEventListener('load', function() {
  chrome.runtime.sendMessage({action: "updateUrl", url: window.location.href});
});

console.log('Content script loaded');

let isExecutingStep = false;

function getPageStructure() {
  const structure = [];

  function getElementInfo(element) {
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      classes: Array.from(element.classList),
      text: element.textContent.trim().substring(0, 100),
      type: element.getAttribute('type') || '',
      name: element.getAttribute('name') || '',
      value: element.value || '',
      placeholder: element.getAttribute('placeholder') || ''
    };
  }

  function isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function traverseDOM(element) {
    if (isVisible(element)) {
      structure.push(getElementInfo(element));
    }

    for (let child of element.children) {
      traverseDOM(child);
    }
  }

  traverseDOM(document.body);
  return JSON.stringify(structure);
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log('Message received in content script:', request);

  if (request.action === "getPageContent") {
    sendResponse({ content: getPageStructure() });
  } else if (request.action === "executeStep") {
    if (!isExecutingStep) {
      isExecutingStep = true;
      executeStep(request.instruction)
        .then(result => {
          console.log('Step execution completed:', result);
          isExecutingStep = false;
          sendResponse({ status: "Step executed", result: result });
          chrome.runtime.sendMessage({ action: "getNextStep" });
        })
        .catch(error => {
          console.error('Error in executeStep:', error);
          isExecutingStep = false;
          sendResponse({ status: "Error", error: error.message });
        });
    } else {
      console.log('Step execution already in progress');
      sendResponse({ status: "Step execution already in progress" });
    }
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "error") {
    console.error('Error received:', request.error);
    sendResponse({ status: "Error received" });
  }
});

async function executeStep(instruction, retries = 3) {
  console.log('Executing instruction:', instruction);

  // 移除前缀的短横线和空格
  const cleanedInstruction = instruction.replace(/^-\s*/, '').trim();
  console.log('Cleaned instruction:', cleanedInstruction);

  const instructions = cleanedInstruction.split('\n').map(i => i.trim()).filter(i => i);
  
  try {
    for (const singleInstruction of instructions) {
      // 使用正则表达式解析动作和参数
      const match = singleInstruction.match(/^([a-zA-Z\s]+):\s*(.*)$/);
      if (!match) {
        throw new Error(`Unrecognized instruction format: ${singleInstruction}`);
      }

      const action = match[1].toLowerCase().trim();
      const fullParams = match[2].trim();
      console.log(`Parsed action: ${action}, params: ${fullParams}`);

      for (let i = 0; i < retries; i++) {
        try {
          let result;
          switch (action) {
            case 'navigate to':
              result = await navigateTo(fullParams);
              break;
            case 'click':
              result = await clickElement(fullParams);
              break;
            case 'input':
              const inputMatch = fullParams.match(/(.+) with (.+)/);
              if (inputMatch) {
                const [, selector, text] = inputMatch;
                result = await inputText(selector.trim(), text.trim());
              } else {
                throw new Error('Invalid input format');
              }
              break;
            case 'select':
              const selectMatch = fullParams.match(/(.+) option (.+)/);
              if (selectMatch) {
                const [, selectName, optionText] = selectMatch;
                result = await selectOption(selectName.trim(), optionText.trim());
              } else {
                throw new Error('Invalid select format');
              }
              break;
            case 'wait':
              result = await wait(parseInt(fullParams));
              break;
            case 'scroll':
              result = await scrollPage(fullParams);
              break;
            default:
              throw new Error(`Unrecognized instruction: ${singleInstruction}`);
          }
          console.log(`Executed: ${singleInstruction}. Result: ${result}`);
          break; // 成功后跳出重试循环
        } catch (error) {
          console.error(`Attempt ${i + 1} for "${singleInstruction}" failed:`, error);
          if (i === retries - 1) {
            console.error(`All ${retries} attempts failed for "${singleInstruction}". Last error:`, error);
            throw error;
          }
          console.log(`Waiting before retry ${i + 2}...`);
          await wait(1000); // 重试前等待1秒
        }
      }
    }

    return "All instructions executed successfully";
  } catch (error) {
    throw error;
  }
}


function navigateTo(url) {
  return new Promise((resolve) => {
    console.log(`Navigating to ${url}`);
    window.location.href = url;
    // Add a delay to wait for the page to load completely
    setTimeout(() => resolve(`Navigated to ${url}`), 5000);
  });
}

async function clickElement(description) {
  console.log(`Searching for element to click: ${description}`);
  const element = await findElement(description);
  if (element) {
    element.click();
    return `Clicked element: ${description}`;
  }
  throw new Error(`Element not found: ${description}`);
}

async function inputText(description, text) {
  console.log(`Searching for input field: ${description}`);
  const element = await findElement(description);
  if (element && (element.tagName.toLowerCase() === 'input' && element.type !== 'submit' || element.tagName.toLowerCase() === 'textarea')) {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return `Input text into ${description}: ${text}`;
  }
  throw new Error(`Input field not found or invalid: ${description}`);
}

async function selectOption(selectDescription, optionText) {
  console.log(`Searching for select element: ${selectDescription}`);
  const selectElement = await findElement(selectDescription);
  if (selectElement && selectElement.tagName.toLowerCase() === 'select') {
    const option = Array.from(selectElement.options).find(opt => opt.text.includes(optionText));
    if (option) {
      selectElement.value = option.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      return `Selected option ${optionText} in ${selectDescription}`;
    }
    throw new Error(`Option ${optionText} not found in ${selectDescription}`);
  }
  throw new Error(`Select element not found: ${selectDescription}`);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    console.log(`Waiting for ${milliseconds} milliseconds`);
    setTimeout(() => {
      resolve(`Waited for ${milliseconds} milliseconds`);
    }, milliseconds);
  });
}

function scrollPage(pixels) {
  return new Promise((resolve) => {
    console.log(`Scrolling the page by ${pixels} pixels`);
    window.scrollBy(0, parseInt(pixels));
    resolve(`Scrolled the page by ${pixels} pixels`);
  });
}

async function findElement(description) {
  console.log(`Searching for element: ${description}`);

  // If the description starts with '#', it's an ID
  if (description.startsWith('#')) {
    const element = document.getElementById(description.slice(1));
    if (element) return element;
  }

  // If the description starts with '.', it's a class
  if (description.startsWith('.')) {
    const element = document.querySelector(description);
    if (element) return element;
  }

  // Try to find by name attribute
  let element = document.querySelector(`[name="${description}"]`);
  if (element) return element;

  // Find by text content (exact match)
  const elements = Array.from(document.body.getElementsByTagName('*'));
  element = elements.find(el => el.textContent.trim() === description);
  if (element) return element;

  // If no exact match, use fuzzy matching
  const potentialMatches = elements.filter(el => {
    const elementText = el.textContent.toLowerCase();
    const descriptionWords = description.toLowerCase().split(' ');
    return descriptionWords.every(word => elementText.includes(word));
  });

  if (potentialMatches.length) return potentialMatches[0];

  console.log(`No element found for description: ${description}`);
  return null;
}