import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Toaster{
    id: number,
    state: boolean, 
    parentClose?: boolean,
    parentStyle?: string,
    onClose?: () => void,
    cardStyle?: string,
    children: () => React.ReactNode
}

const utilSlice = createSlice({
    name: "utilSlice",
    initialState: {
        toasters: [] as Toaster[],
    },
    reducers: {
        setToaster: (state, action: PayloadAction<any>) => {
            const lastID = state.toasters[state.toasters.length - 1]?.id;
            state.toasters.push({...action.payload, id: lastID || 1});
        },
        closeToaster: (state, action: PayloadAction<number>) => {
            const filter = state.toasters.filter((toaster: any) => toaster.id != action.payload);
            state.toasters = filter;
        }
    }
})

export const {setToaster, closeToaster} = utilSlice.actions;
export default utilSlice.reducer;