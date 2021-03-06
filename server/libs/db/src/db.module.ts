import { Module, Global } from "@nestjs/common";
import { DbService } from "./db.service";
import { TypegooseModule } from "nestjs-typegoose";
import { AdminUser } from "./models/adminuser.model";
import { Comic } from "./models/comic.model";
import { Season } from "./models/season.model";
import { User } from "./models/user.model";

const models = TypegooseModule.forFeature([AdminUser, User, Comic, Season]);

@Global()
@Module({
	imports: [
		TypegooseModule.forRoot("mongodb://localhost:27017/nestjs-comic-test", {
			useCreateIndex: true,
			useNewUrlParser: true,
			useUnifiedTopology: true,
			useFindAndModify: true
		}),
		models
	],
	providers: [DbService],

	exports: [DbService, models]
})
export class DbModule {}
