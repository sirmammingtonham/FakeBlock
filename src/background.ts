import {browser, Runtime} from 'webextension-polyfill-ts';
import {Classifier, ClassifierOutput} from './detection/classifier';
import {ClassifierFactory, ClassifierTypes} from './factory/classifier-factory';

console.log('background script test');
const factory: ClassifierFactory = new ClassifierFactory();
let imageScanner: Classifier;
let textScanner: Classifier;

(async () => {
	imageScanner = await factory.createClassifier({type: ClassifierTypes.kImage});
	textScanner = await factory.createClassifier({type: ClassifierTypes.kText});

	if (!imageScanner) {
		console.error('Couldn\'t get image scanner!');
	}

	if (!textScanner) {
		console.error('Couldn\'t get text scanner!');
	}

	const enabled: boolean = (await browser.storage.local.get('enabled'))?.enabled ?? true;
	await browser.browserAction.setIcon({path: enabled ? '../assets/icon.png' : '../assets/icon_disabled.png'});
})();

async function createResultPage(result: ClassifierOutput) {
	if (result) {
		const url = `/public/results.html?res=${
			encodeURIComponent(JSON.stringify(result))
		}`;
		await browser.tabs.create({url});
	}
}

// Scans image
browser.contextMenus.create(
	{
		id: 'scan-image',
		title: 'Scan with fakeBlock', // Browser.i18n.getMessage("contextMenuItemSelectionLogger"),
		contexts: ['image']
	},
	() => {
		console.log('image context menu created');
	}
);

// Scans text
browser.contextMenus.create(
	{
		id: 'scan-selection',
		title: 'Scan with fakeBlock',
		contexts: ['selection']
	},
	() => {
		console.log('text selection context menu created');
	}
);

browser.contextMenus.onClicked.addListener(async (info, _tab) => {
	switch (info.menuItemId) {
		case 'scan-image':
			if (info.srcUrl) {
				await imageScanner.classify(info.srcUrl);
			}

			break;
		case 'scan-selection':
			if (info.selectionText) {
				const result = await textScanner.classify({body: info.selectionText});
				await createResultPage(result);
			}

			break;
		default:
			break;
	}
});

browser.runtime.onMessage.addListener(async (request: any, sender: Runtime.MessageSender) => {
	switch (request?.message) {
		case 'getEnabled': {
			const retrieved = await browser.storage.local.get('enabled');
			const enabled = !retrieved.enabled ?? true;
			return {response: enabled};
		}

		case 'reload': {
			await browser.tabs.reload();

			break;
		}

		case 'scanText': {
			const text = request?.text;
			if (text) {
				return textScanner.classify({body: text});
			}

			break;
		}

		case 'openNewTab': {
			const result = request?.result;
			if (result) {
				await createResultPage(result);
			}

			break;
		}

		case 'updateBadge': {
			const count = request?.count;
			const tabId = sender.tab?.id;
			if (count && tabId) {
				await browser.storage.local.set({count});
				await browser.browserAction.setBadgeText({text: `${count as number}`, tabId});
			} else {
				await browser.storage.local.set({count: 0});
				await browser.browserAction.setBadgeText({text: '', tabId});
			}

			break;
		}

		default:
			break;
	}

	return false;
});
