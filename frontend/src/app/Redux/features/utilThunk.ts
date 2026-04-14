import { AppDispatch } from "../store";
import { setToaster } from "./utilSlice";

export const showToaster = () => (dispatch: AppDispatch) => {
    dispatch(setToaster({
        state: true, 
        // parentClose?: boolean,
        // parentStyle?: string,
        // onClose?: () => void,
        // cardStyle?: string,
        // children: React.ReactNode
    }))
}
