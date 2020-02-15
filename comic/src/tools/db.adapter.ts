import Vue from "vue";
import { AxiosInstance, AxiosResponse, AxiosRequestConfig } from "axios";
import { DBComicType, DBSeasonType, DBUserType, DBSettingType } from "./db.adapter.types";

class CustomHttp {
	private headers: any = {};
	get http() {
		return Vue.prototype.$http as AxiosInstance;
	}
	get(url: string, config?: AxiosRequestConfig | undefined): Promise<AxiosResponse<any>> {
		config = this.attachHeaders(config);
		return this.http.get(url, config);
	}
	post(url: string, data?: any, config?: AxiosRequestConfig | undefined): Promise<AxiosResponse<any>> {
		config = this.attachHeaders(config);
		return this.http.post(url, data, config);
	}
	attachHeaders(config?: AxiosRequestConfig | undefined) {
		if (!config) config = {};
		if (!config.headers) config.headers = {};
		for (let k in this.headers) config.headers[k] = this.headers[k];
		return config;
	}
	setHeader(key, value) {
		this.headers[key] = value;
	}
}

/**数据适配器 */
export default class DBAdapter {
	public accessToken: string = "";
	public user: DBUserType | null;
	public http: CustomHttp = new CustomHttp();
	constructor() {
		this.loadUserData();
	}

	public error(msg) {
		Vue.prototype.$tools.toast(msg, "error");
	}
	public isOK(res) {
		if (res.data && res.data.statusCode == 0) {
			return true;
		} else {
			this.error(res.data.message || res.statusText);
			return false;
		}
	}
	/**搜索漫画 */
	public async search(content: any, useParser?: string): Promise<DBComicType[]> {
		const res = await this.http.post("/comic/search", {
			content,
			useParser
		});
		if (this.isOK(res)) return res.data.data || [];
		else return [];
	}

	/**获取漫画数据 */
	public async getComic(id: string): Promise<DBComicType> {
		const res = await this.http.get("/comic/parsecomic?id=" + id);
		if (this.isOK(res)) {
			if (res.data.data.err) {
				this.error(res.data.data.msg);
				return new DBComicType();
			}
			const comic: DBComicType = res.data.data.comic || new DBComicType();
			const seasons = comic.seasons || [];
			await this.setUserData(res.data.data.user);
			seasons.sort(function(a, b) {
				return b.sidx - a.sidx;
			});
			comic.seasons = [];
			comic.seasons_other = [];
			comic.seasons_book = [];
			// console.log(this.user?.seasonhistory);
			seasons.map(s => {
				s.isHistory = false;
				if (this.user) {
					const idx = this.user.seasonhistory.findIndex(v => {
						return v == s._id;
					});
					if (idx >= 0) s.isHistory = true;
				}
				if (s.isHistory) console.log(s.name);
				switch (s.type) {
					case "normal":
						comic.seasons.push(s);
						break;
					case "other":
						comic.seasons_other.push(s);
						break;
					case "book":
						comic.seasons_book.push(s);
						break;
				}
			});
			return comic;
		} else return new DBComicType();
	}

	/**获取漫画分集数据 */
	public async getSeason(id: string): Promise<DBSeasonType> {
		const res = await this.http.get("/comic/parseseason?id=" + id);
		if (this.isOK(res)) {
			if (res.data.data.err) {
				this.error(res.data.data.msg);
				return new DBSeasonType();
			}
			const season: DBSeasonType = res.data.data.season || new DBSeasonType();
			season.pages = season.images.length;
			season.pre = res.data.data.pre;
			season.next = res.data.data.next;
			return season;
		} else return new DBSeasonType();
	}

	/**注册 */
	public async register(username: string, password: string): Promise<boolean> {
		const res = await this.http.post("/auth/register", {
			username,
			password
		});
		return this.isOK(res);
	}
	/**登录 */
	public async login(username: string, password: string): Promise<DBUserType | null> {
		const res = await this.http.post("/auth/login", {
			username,
			password
		});
		if (this.isOK(res)) {
			console.log(res.data);
			this.accessToken = res.data.data.accessToken;
			this.user = res.data.data.user;
			return this.setUserData(this.user);
		} else {
			return null;
		}
	}
	/**收藏漫画 */
	public async starComic(id: string) {
		const res = await this.http.get("/user/starcomic?id=" + id);
		if (this.isOK(res)) {
			console.log(res.data);
			return this.setUserData(res.data.data);
		} else return null;
	}
	//取消收藏漫画
	public async cancelStarComic(id: string) {
		const res = await this.http.get("/user/cancelstarcomic?id=" + id);
		if (this.isOK(res)) {
			console.log(res.data);
			return this.setUserData(res.data.data);
		} else return null;
	}

	/**保存用户数据 */
	public async setUserData(user: DBUserType | null): Promise<DBUserType | null> {
		this.user = user;
		let userdata = {
			user: this.user,
			accessToken: this.accessToken
		};
		if (this.accessToken) this.http.setHeader("Authorization", "Bearer " + this.accessToken);
		else this.http.setHeader("Authorization", undefined);
		window.localStorage.setItem("comic_userdata", JSON.stringify(userdata));
		return this.user;
	}
	/**获取用户数据 */
	public async getUserData(): Promise<DBUserType | null> {
		return this.user;
	}
	/**加载用户数据 */
	public loadUserData() {
		// window.localStorage.removeItem("comic_userdata");
		let str_userdata = window.localStorage.getItem("comic_userdata");
		if (str_userdata) {
			let userdata = JSON.parse(str_userdata);
			this.user = userdata.user;
			this.accessToken = userdata.accessToken;
			if (this.accessToken) this.http.setHeader("Authorization", "Bearer " + this.accessToken);
			else this.http.setHeader("Authorization", undefined);
			console.log("加载用户数据");
			console.log(userdata);
		} else {
			this.user = null;
			this.accessToken = "";
		}
	}

	/**更新配置 */
	public updateSetttings(settings: DBSettingType): DBSettingType {
		let db_settings = this.getSettings();
		for (let k in settings) db_settings[k] = settings[k];
		window.localStorage.setItem("comic_settings", JSON.stringify(db_settings));
		return db_settings;
	}
	/**获取设置 */
	public getSettings(): DBSettingType {
		let str_settings = window.localStorage.getItem("comic_settings");
		let db_settings = new DBSettingType();
		if (str_settings) {
			db_settings = JSON.parse(str_settings) as DBSettingType;
		}
		return db_settings;
	}
}