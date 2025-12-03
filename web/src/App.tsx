import React from 'react';
import {Navbar} from "./components/navbar";
import {createBrowserRouter, Outlet, RouterProvider} from "react-router-dom";
import {HomePage} from "./pages/home-page";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {ToastProvider} from "./components/ui/toast";

const router = createBrowserRouter([
    {
        path: "/",
        element: (
            <>
                <Navbar />
                <div className={"px-8 pt-4 pb-16"}>
                    <Outlet />
                </div>
            </>
        ),
        children: [
            {
                path: "/",
                element: <HomePage />,
            },
        ]
    }
]);

function App() {
    return <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
            <RouterProvider router={router} />
            <ReactQueryDevtools />
        </ToastProvider>
    </QueryClientProvider>
}

export default App;
