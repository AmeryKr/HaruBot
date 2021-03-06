"use strict";
let commandsInModule = [];
let unirest = require('unirest');
let request = require('request');

const auth = require("../../auth.json");
const pats = require("../lists/pats.js").pats;
const Permissions = require("../../databases/helpers/permissions.js");
const ServerSettings = require("../../databases/helpers/serversettings.js");
const cooldowns = require("../../helpers/cooldown.js");

commandsInModule.pat = {
	name: 'pat', module: 'Fun',
	help: 'Pats a user!',
	usage: '[@user/user]',
	cooldown: 10, levelReq: 0,
	exec: function (Client, msg, args) {
		if (msg.mentions.length <= 0) {
			/* We need to fetch all the members to search in a broader list */
			Client.Users.fetchMembers();

			let userObj = Client.Users.getBy("username", args);

			if (!userObj) {
				msg.channel.sendMessage(":warning: User `" + args + "` doesn't seem to exist.");
				return;
			}

			let guildUserObj = userObj.memberOf(msg.guild);

			if (!guildUserObj) {
				msg.channel.sendMessage(":warning: User `" + args + "` doesn't seem to exist.");
				return;
			}

			msg.channel.sendMessage(guildUserObj.mention + " you have been patted by " + msg.author.mention + "\n" +
			pats[Math.floor(Math.random() * pats.length)]);
		} else {
			if (msg.mentions.length > 1) {
				msg.channel.sendMessage(":confounded: Sorry, I can only pat one user at a time.");
				return;
			}

			let guildUserObj = msg.mentions[0].memberOf(msg.guild);

			if (!guildUserObj) {
				msg.channel.sendMessage(":warning: User tagged is not a valid member of the guild!");
				return;
			}

			msg.channel.sendMessage(guildUserObj.mention + " you have been patted by " + msg.author.mention + "\n" +
			pats[Math.floor(Math.random() * pats.length)]);
		}
	}
}

commandsInModule.ud = {
	name: 'ud', module: 'Fun',
	help: 'Looks up a definition on Urban Dictionary.',
	usage: '[search terms]',
	cooldown: 30, levelReq: 0,
	exec: function (Client, msg, args) {
		if (!args) {
			msg.channel.sendMessage(":warning: No arguments specified!");
		}

		let definitionURL = "https://mashape-community-urban-dictionary.p.mashape.com/define?term=" + args.split(" ").join("+");

		unirest.get(definitionURL).header("X-Mashape-Key", auth.mashapeKey)
		.header("Accept", "text/plain")
		.end(function (result) {
			if (result.status === 200) {
				if (result.body) {
					let msgArray = [];
					let topResult = result.body.list[0];

					msgArray.push("__**Search terms**__: **" + args + "**");
					msgArray.push("__**Definition**__: " + topResult.definition);
					msgArray.push("__**Example**__:\n*" + topResult.example + "*");
					msgArray.push("__**Author**__: " + topResult.author);
					msgArray.push("__**Thumbs Up**__: " + topResult.thumbs_up + " | __Thumbs Down__: " + topResult.thumbs_down);
					msgArray.push("<" + topResult.permalink + ">");

					msg.channel.sendMessage(msgArray.join("\n"));
				}
			} else {
				msg.channel.sendMessage(":warning: Something went wrong while trying to get the definition, or it doesn't exist!");
			}
		});
	}
}

commandsInModule.roll = {
	name: 'roll', module: 'Fun',
	help: 'Roll a dice! If no dice type is specified, the default is 1d6.',
	usage: '[(number of rolls)d(sides of the dice)]',
	cooldown: 10, levelReq: 0,
	exec: function (Client, msg, args) {
		let arg = args.split(" ");
		let dice, urlReq, object;

		if (!/\d+d\d+/.test(arg[0])) {
			dice = "1d6";
		} else {
			dice = arg[0];
		}

		urlReq = `https://rolz.org/api/?${dice}.json`

		request(urlReq, {}, function(error, response, body) {
			if (error) {
				console.log(error);
				msg.channel.sendMessage(":warning: There was an error while processing that request. Details:\n```xl\n" + error + "```");
			}

			if (response.statusCode === 200) {
				object = JSON.parse(body);

				msg.channel.sendMessage(":game_die: You rolled a **" + object.result + "**!\n__Details__:" + object.details);
			}
		});
	}
}

commandsInModule.russianroulette = {
	name: 'russianroulette', module: 'Fun',
	help: 'Play russian roulette! If you lose, you get muted for 1 to 5 minutes, so be careful.',
	usage: '',
	cooldown: 120, levelReq: 0,
	exec: function (Client, msg, args) {
		if (!Client.User.permissionsFor(msg.guild).General.MANAGE_ROLES) {
			msg.channel.sendMessage(':sob: I do not have permission to manage roles in this server!');
			return;
		}

		let time = (Math.floor(Math.random() * 4) + 1) * 60 * 1000;
		let chance = parseInt(Math.floor(Math.random() * 2));

		if (chance === 1) {
			Permissions.getMuteRole(msg.guild).then(r => {
				let muteRole = msg.guild.roles.find(k => k.id === r);

				if (!muteRole) {
					msg.channel.sendMessage(':warning: No mute role has been set! Set it with `setmute [Role Name/@Role]`');
					return;
				}

				let member = msg.author.memberOf(msg.guild);

				member.assignRole(muteRole).then(() => {
					msg.channel.sendMessage(':gun: Member `' + member.username + '#' + member.discriminator + '` got shot while playing Russian Roulette! (muted for: **' + (time / 1000 / 60) + '** minutes).')
				}).catch(er => {
					console.log(er);
				});

				setTimeout(() => {member.unassignRole(muteRole)}, time);
			});
		} else {
			msg.channel.sendMessage(":relieved: The odds were with you this time!");
		}
	}
}

commandsInModule.color = {
	name: 'color', module: 'Fun',
	help: 'Set a custom color role for yourself!',
	usage: '[color hex]',
	cooldown: 300, levelReq: 1,
	exec: function (Client, msg, args) {
		ServerSettings.checkColors(msg.guild).then(r => {
			if (r === "ENABLED") {
				if (!/#[A-F0-9]{6}/i.test(args) || args.length > 7) {
					msg.reply("invalid color hex! Precede the code by a `#`. Only numbers and letters A through F are allowed. Example: `#B4A90F`");
					cooldowns.resetCooldown("color", msg.guild.id, msg.author.id);
					return;
				} else if (!args) {
					msg.reply("you did not specify a color!");
					cooldowns.resetCooldown("color", msg.guild.id, msg.author.id);
					return;
				}

				if (!Client.User.permissionsFor(msg.guild).General.MANAGE_ROLES) {
					msg.channel.sendMessage(':sob: I do not have permission to manage roles in this server!');
					cooldowns.resetCooldown("color", msg.guild.id, msg.author.id);
					return;
				}

				/* Make it so that it deletes the previous role */
				let userRoles = msg.member.roles;

				for (let x of userRoles) {
					if (/#[A-F0-9]{6}/.test(x.name)) {
						msg.member.unassignRole(x).then(() => {
							console.log("Deleted member from color role");
						});
					}
				}

				setTimeout(() => {
					/* See if the color role already exists */
					let findColorRole = msg.guild.roles.find(k => k.name === args.toUpperCase());

					if (findColorRole) {
						msg.member.assignRole(findColorRole).then(() => {
							msg.channel.sendMessage(":ok_hand::skin-tone-1: Your color has been set to `" + args.toUpperCase() + "`. Note: if the color doesn't show up, make sure that there are no other roles with colors on top of your color role.");
						}).catch(e => {
							msg.channel.sendMessage(':interrobang: Woah! Something went wrong while running that command!. Stack:\n```xl\n' + e.stack + '```');
						});
					} else { /* If there was no role already made, we create it */
						msg.guild.createRole().then(newRole => {
							let rolePerms = newRole.permissions;

							/* Empty role permissions */
							for (var x in rolePerms.General) {
								rolePerms.General[x] = false;
							}
							for (var x in rolePerms.Text) {
								rolePerms.Text[x] = false;
							}
							for (var x in rolePerms.Voice) {
								rolePerms.Voice[x] = false;
							}

							let name = args.toUpperCase();
							let color = parseInt("0x" + args.replace(/#/, ""));

							newRole.commit(name, color, false, false).then(() => {}).catch(e => {
								msg.channel.sendMessage(':interrobang: Woah! Something went wrong while running that command!. Stack:\n```xl\n' + e.stack + '```');
							});

							msg.member.assignRole(newRole).then(() => {
								msg.channel.sendMessage(":ok_hand::skin-tone-1: Your color has been set to `" + args.toUpperCase() + "`. Note: if the color doesn't show up, make sure that there are no other roles with colors on top of your color role.");
							}).catch(e => {
								msg.channel.sendMessage(':interrobang: Woah! Something went wrong while running that command!. Stack:\n```xl\n' + e.stack + '```');
							});
						});
					}
				}, 1000);
			} else if (r === "DISABLED") {
				msg.channel.sendMessage(":raised_hand::skin-tone-1: Color roles are disabled on this server!");
				cooldowns.resetCooldown("color", msg.guild.id, msg.author.id);
			}
		}).catch(e => {
			console.log(er);
		})
	}
}

exports.commandsInModule = commandsInModule;
