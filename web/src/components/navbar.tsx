import {Button} from "./ui/button";
import {Link} from "react-router-dom";
import {MoonStar, Sun, TriangleAlertIcon, UserIcon} from "lucide-react";
import {useColorScheme} from "../lib/color-scheme";
import {useUserQuery} from "../data/queries/user";
import Spinner from "./ui/spinner";

export function Navbar () {
    const { isDark, setIsDark } = useColorScheme();

    function toggleDarkMode() {
        setIsDark(!isDark);
    }

    return <div className={"animate-in slide-in-from-top-2 fade-in duration-300"}>
        <div className={"h-16"}></div>
        <div
            className={
                "px-8 h-16 border-b-accent border-b-2 fixed right-0 left-0 top-0 bg-background z-40"
            }
        >
            <div className={"py-3 flex items-center justify-between gap-2"}>
                <div className={"flex gap-2 items-center"}>
                    <Link to={"/"}>
                        <div
                            className={
                                "cursor-pointer me-2 w-10 h-10 bg-primary rounded-lg flex flex-col items-center justify-center text-white font-semibold text-xs"
                            }
                        >
                            Tekkr
                        </div>
                    </Link>
                </div>
                <div className={"grow"} />
                <ProfilePreview />
                <div className={"flex gap-4 items-center"}>
                    <Button variant={"ghost"} onClick={toggleDarkMode}>
                        { isDark && <Sun /> }
                        { !isDark && <MoonStar /> }
                    </Button>
                </div>
            </div>
        </div>
    </div>
}

function ProfilePreview () {
    const userQuery = useUserQuery();

    if (userQuery.isError) {
        return <div className={"text-destructive text-sm font-medium flex flex-row items-center gap-2 rounded-md outline-destructive outline-1"}>
            <TriangleAlertIcon className={"w-4 h-4"} />
            No Connection...
            <div onClick={() => userQuery.refetch()} className={"cursor-pointer underline"}>retry</div>
        </div>
    }

    return <div
        className={"border rounded-md px-3 py-1 text-muted-foreground bg-muted flex flex-row items-center text-sm"}>
        <UserIcon className={"w-4 h-4 me-2"}></UserIcon>
        {userQuery.isPending ? <Spinner/> : userQuery.data?.name}
    </div>
}