const Manifest = chrome.runtime.getManifest();
const SettingsURL = chrome.runtime.getURL('settings.html');

const DefaultSettings = {
	PinnedGamesOn: true,
	ForumMentsOn: true,
	BestFriendsOn: false,
	ImprovedFrListsOn: false,
	IRLPriceWithCurrency: {
		Enabled: true,
		Currency: 0,
		Package: 0
	},
	IRLPriceWithCurrencyOn: true,
	IRLPriceWithCurrencyCurrency: 0,
	IRLPriceWithCurrencyPackage: 0,
	HideNotifBadgesOn: false,
	StoreOwnTagOn: true,
	ThemeCreatorOn: false,
	ThemeCreator: {
		Enabled: false,
		BGColor: null,
		BGImage: null,
		BGImageSize: 'fit',
		PrimaryTextColor: null,
		SecondaryTextColor: null,
		LinkTextColor: null,
		WebsiteLogo: null
	},
	ModifyNavOn: false,
	ModifyNav: [
		{
			Label: 'Places',
			Link: 'https://polytoria.com/places'
		},
		{
			Label: 'Store',
			Link: 'https://polytoria.com/store'
		},
		{
			Label: 'Guilds',
			Link: 'https://polytoria.com/guilds'
		},
		{
			Label: 'People',
			Link: 'https://polytoria.com/users'
		},
		{
			Label: 'Forum',
			Link: 'https://polytoria.com/forum'
		}
	],
	MoreSearchFiltersOn: true,
	ApplyMembershipTheme: {
		Enabled: false,
		Theme: 0
	},
	ApplyMembershipThemeOn: false,
	ApplyMembershipThemeTheme: 0,
	MultiCancelOutTradesOn: true,
	ItemWishlistOn: true,
	HideUpgradeBtnOn: false,
	TryOnItemsOn: true,
	OutfitCostOn: true,
	ShowPlaceRevenueOn: true,
	ReplaceItemSalesOn: false,
	HoardersListOn: true,
	HoardersList: {
		Enabled: true,
		AvatarsEnabled: false,
		MinCopies: 2
	},
	LibraryDownloadsOn: true,
	EventItemsCatOn: true,
	HomeFriendCountOn: true,
	HideUserAds: {
		Enabled: false,
		Banners: true,
		Rectangles: true
	},
	UploadMultipleDecals: true,
	GD_ServerBalanceOn: true,
	AvatarDimensionToggleOn: true,
	TheGreatDivide: {
		Enabled: true,
		UnbalancedIndicatorOn: true,
		MVPUserIndicatorOn: true,
		UserStatsOn: true,
		LeaderboardsOn: true
	},
	CollectibleInventoryCatOn: true,
	ShowValueListDataOn: true,
	ImprovedAchievements: {
		Enabled: true,
		ProgressBarOn: true,
		PercentageOn: true,
		OpacityOn: true
	},
	ReaddCopyablePlacesOn: true,
	TimePlayedOn: true,
	HomeJoinFriendsButtonOn: true,
	ImprovedPlaceManagement: {
		Enabled: true,
		QuickActivityToggleOn: true,
		PlaceFileDownloadOn: true,
		MultiWhitelistOn: true,
		ClearWhitelistOn: true
	}
}

// ON EXTENSION INSTALL / RELOAD
chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.sync.get(['PolyPlus_Settings'], function(result){
		const MergedSettings = MergeObjects((result.PolyPlus_Settings || DefaultSettings), DefaultSettings)
		chrome.storage.sync.set({'PolyPlus_Settings': MergedSettings}, function(){
			console.log('Successfully merged settings')
		})
	})
});

let RecordingTimePlayed = false
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.action === 'reload') {
		chrome.runtime.reload();
	} else if (request.action === 'start_time_played') {
		if (RecordingTimePlayed === true) {
			console.log('Time Played: Already Started Interval')
			return
		}
		RecordingTimePlayed = true

		chrome.storage.sync.get(['PolyPlus_TimePlayed'], function(result){
			console.log('Time Played: Start Interval')

			const Playtime = result.PolyPlus_TimePlayed || {
				[request.placeID]: 0
			};
			let LoadedIn = false
			const TimePlayedInterval = setInterval(async () => {
				console.log('Time Played: Run Check')
				const PlaceStatus = (await (await fetch('https://api.polytoria.com/v1/users/' + request.userID)).json()).playing

				if (PlaceStatus === null) {
					console.log('Time Played: Not Playing Anything')
					if (LoadedIn === true) {
						console.log('Time Played: End Interval')
						clearInterval(TimePlayedInterval)
					}
				} else {
					LoadedIn = true
					if (!Playtime[PlaceStatus.placeID]) {
						Playtime[PlaceStatus.placeID] = 0
					}
					Playtime[PlaceStatus.placeID] += 5
					console.log('Time Played: Time Increase: ', new Date(Playtime[PlaceStatus.placeID] * 1000).toISOString().slice(11, 19), PlaceStatus)
					chrome.storage.sync.set({'PolyPlus_TimePlayed': Playtime}, function(){
						console.log('Time Played: Saved Playtime')
					})
				}
			}, 5000);
		})
	}
});

// WHEN CLICKING ON EXTENSION ICON OPEN THE SETTINGS PAGE
chrome.action.onClicked.addListener((tab) => {
	chrome.tabs.create({active: true, url: SettingsURL});
});

// REGISTER AN ALARM FOR DAILY UPDATE CHECK
chrome.alarms.create('PolyPlus-UpdateCheck', {
	when: Date.now() + GetNext12PM()
});

function GetNext12PM() {
	const Now = new Date();
	const Next = new Date();
	Next.setHours(12, 0, 0, 0);
	if (Now.getHours() >= 12) {
		Next.setDate(Next.getDate() + 1);
	}
	return Next - Now;
}

// HANDLE ALARMS FIRING
/*
chrome.alarms.onAlarm.addListener(function (alarm) {
	if (alarm.name === 'PolyPlus-UpdateCheck') {
		RunUpdateNotifier();
	}
});
*/
function RunUpdateNotifier() {
	chrome.storage.local.get(['PolyPlus_LiveVersion', 'PolyPlus_OutOfDate', 'PolyPlus_SkipUpdate'], function (result) {
		const OutOfDate = result.PolyPlus_OutOfDate || false;
		const SkipUpdate = result.PolyPlus_SkipUpdate || null;
		const LiveVersion = result.PolyPlus_LiveVersion || Manifest.version;
		if (OutOfDate !== true && SkipUpdate !== LiveVersion) {
			fetch('https://polyplus.vercel.app/data/version.json')
				.then((response) => {
					if (!response.ok) {
						throw new Error('Network not ok');
					}
					return response.json();
				})
				.then((data) => {
					chrome.storage.local.set({PolyPlus_LiveVersion: data.version}, function () {
						console.log('Cached live version');
					});
					if (data.version > Manifest.version) {
						chrome.storage.local.set({PolyPlus_OutOfDate: true, PolyPlus_ReleaseNotes: data.releaseNotes}, function () {
							console.log('Cached update notifier result');
						});
						chrome.notifications.create(
							'',
							{
								type: 'basic',
								iconUrl: chrome.runtime.getURL('icon.png'),
								title: 'New Update Available',
								message: 'A new update is available for Poly+! (v' + data.version + ')'
							},
							function (notificationID) {
								chrome.notifications.onClicked.addListener(function (id) {
									if (id === notificationID) {
										chrome.tabs.create({url: 'https://github.com/IndexingGitHub/PolyPlus/releases', active: true});
										chrome.notifications.clear(notificationID);
									}
								});
							}
						);
					}
				})
				.catch((error) => {
					console.log(error);
				});
		}
	});
}

chrome.contextMenus.removeAll(function () {
	chrome.contextMenus.create({
		title: 'Run Update Notifier',
		id: 'PolyPlus-RunUpdateNotifier',
		contexts: ['all'],
		documentUrlPatterns: [
			'https://polytoria.com/my/settings/polyplus*'
		]
	});

	// COPY ASSET ID CONTEXT MENU ITEM REGISTRATION
	/*
	const AssetTypes = ["Place", "User", "Item", "Guild"]
	AssetTypes.forEach(type => {
		chrome.contextMenus.create({
			title: 'Copy ' + type + ' ID',
			id: 'PolyPlus-Copy' + type + 'ID',
			contexts: ['link'],
			documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
			targetUrlPatterns: [
				'https://polytoria.com/places/**'
			]
		});
	})
	*/
	chrome.contextMenus.create({
		title: 'Copy Place ID',
		id: 'PolyPlus-CopyPlaceID',
		contexts: ['link'],
		documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
		targetUrlPatterns: [
			'https://polytoria.com/places/**'
		]
	});
	chrome.contextMenus.create({
		title: 'Copy User ID',
		id: 'PolyPlus-CopyUserID',
		contexts: ['link'],
		documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
		targetUrlPatterns: [
			'https://polytoria.com/users/**',
			'https://polytoria.com/u/**'
		]
	});
	chrome.contextMenus.create({
		title: 'Copy Item ID',
		id: 'PolyPlus-CopyItemID',
		contexts: ['link'],
		documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
		targetUrlPatterns: [
			'https://polytoria.com/store/**'
		]
	});
	chrome.contextMenus.create({
		title: 'Copy Guild ID',
		id: 'PolyPlus-CopyGuildID',
		contexts: ['link'],
		documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
		targetUrlPatterns: [
			'https://polytoria.com/guilds/**'
		]
	});
	chrome.contextMenus.create({
		title: 'Copy Thread ID',
		id: 'PolyPlus-CopyThreadID',
		contexts: ['link'],
		documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
		targetUrlPatterns: [
			'https://polytoria.com/forum/post/**'
		]
	});

	// COPY AVATAR HASH CONTEXT MENU ITEM REGISTRATION
	chrome.contextMenus.create({
		title: 'Copy Avatar Hash',
		id: 'PolyPlus-CopyAvatarHash',
		contexts: ['image'],
		documentUrlPatterns: ['https://polytoria.com/*', SettingsURL],
		targetUrlPatterns: [
			'https://c0.ptacdn.com/thumbnails/avatars/**'
		]
	});
});

// HANDLE CONTEXT MENU ITEMS
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
	if (["CopyPlaceID", "CopyUserID", "CopyItemID", "CopyGuildID"].indexOf(info.menuItemId.split('-')[1]) !== -1) {
		let ID = info.linkUrl.split('/')[4];
		if (info.linkUrl.split('/')[3] === 'u') {
			ID = (await (await fetch('https://api.polytoria.com/v1/users/find?username=' + info.linkUrl.split('/')[4])).json()).id;
		}
		chrome.scripting
			.executeScript({
				target: {tabId: tab.id},
				func: CopyAssetID,
				args: [ID]
			})
			.then(() => console.log('Copied ID!'));
	}

	if (info.menuItemId === 'PolyPlus-CopyThreadID') {
		let ID = info.linkUrl.split('/')[5];
		chrome.scripting
			.executeScript({
				target: {tabId: tab.id},
				func: CopyAssetID,
				args: [ID]
			})
			.then(() => console.log('Copied ID!'));
	}

	if (info.menuItemId === 'PolyPlus-CopyAvatarHash') {
		let Hash = new URL(info.srcUrl).pathname.split('/')[3].replace('-icon', '').replace('.png', '');
		chrome.scripting
			.executeScript({
				target: {tabId: tab.id},
				func: CopyAvatarHash,
				args: [Hash]
			})
			.then(() => console.log('Copied ID!'));
	}

	if (info.menuItemId === 'PolyPlus-RunUpdateNotifier') {
		RunUpdateNotifier();
	}
});

/*
GREEN LOGO WHEN EXTENSION APPLIES TO CURRENT TAB PAGE, RED WHEN IT DOESN'T
COMING SOON

chrome.tabs.onActivated.addListener(function (info){
    chrome.tabs.get(info.tabId, function(tab){
        const Any = CheckIfScriptApplies(tab.url)
        console.log(Any)
    });
});

function CheckIfScriptApplies(url) {
	const matches = Manifest.content_scripts.map(script => {
        script.matches.forEach(match => {
			console.log(url, match, url.startsWith(match))
            if (url.startsWith(match)) {
                return true
            } else {
				return false
			}
        })
    })

	return matches
}

function matchesUrl(patterns, url) {
    return patterns.some(pattern => {
        return new RegExp(pattern).test(url);
    });
}
*/

function CopyAssetID(id) {
	navigator.clipboard
		.writeText(id)
		.catch((err) => {
			alert('Failure to copy ID.', err);
		});
}

function CopyAvatarHash(hash) {
	navigator.clipboard
		.writeText(hash)
		.then(() => {
			alert('Successfully copied avatar hash!');
		})
		.catch(() => {
			alert('Failure to copy avatar hash.');
		});
}

function OpenSweetAlert2Modal(icon, title, text) {
	console.log(window, window.Swal, window.bootstrap)
	window.Swal.fire({
		icon: icon,
		title: title,
		text: text
	})
}

// MergeObjects function was written by ChatGPT cause I was lazy and it was awhile ago
function MergeObjects(obj1, obj2) {
	var mergedObj = {};

	// Copy the values from obj1 to the mergedObj
	for (var key in obj1) {
		mergedObj[key] = obj1[key];
	}

	// Merge the values from obj2 into the mergedObj, favoring obj2 for non-existing keys in obj1
	for (var key in obj2) {
		if (!obj1.hasOwnProperty(key)) {
			mergedObj[key] = obj2[key];
		}
	}

	return mergedObj;
}