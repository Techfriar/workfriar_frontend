import {
  TimeEntry,
  TimesheetDataTable,
  WeekDaysData,
} from "@/interfaces/timesheets/timesheets";
import TimeInput from "@/themes/components/time-input/time-input";
import {
  minutesToTime,
  timeToMinutes,
} from "@/utils/timesheet-utils/timesheet-time-formatter";
import React, { ReactNode, useState } from "react";
import styles from "./pending-detailed-view.module.scss";
import { Dropdown, message } from "antd";
import CustomTable from "@/themes/components/custom-table/custom-table";
import ButtonComponent from "@/themes/components/button/button";
import Icons from "@/themes/images/icons/icons";
import TextAreaButton from "@/module/time-sheet/components/text-area-button/text-area-button";
import UseReviewTimesheetsServices from "@/module/review-timesheet/services/review-timesheets-service";
import ConfirmationModal from "@/module/time-sheet/components/confirmation-modal/confirmation-modal";

/**
 * Props for the PendingDetailedView component.
 */
interface PendingDetailedViewProps {
  timeSheetData: TimesheetDataTable[]; // Timesheet data for the pending view
  daysOfWeek: WeekDaysData[]; // Days of the week to map data
  backButtonFunction: () => void; // Callback for the back button
  setTimesheetData: (timesheet: TimesheetDataTable[]) => void;
  userId:string;
}

/**
 * PendingDetailedView component displays a detailed breakdown of pending timesheets.
 */
const PendingDetailedView: React.FC<PendingDetailedViewProps> = ({
  timeSheetData,
  daysOfWeek,
  backButtonFunction,
  setTimesheetData,
  userId
}) => {
  const [loading, setLoading] = useState(false); // Tracks loading state
  const [showTaskDetailModal, setTaskDetailModal] = useState<boolean>(false); // Modal toggle for task details
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null); // Tracks the row being edited
  const [rejectionNote, setRejectionNote] = useState<string>(); // Rejection note for rejected timesheets
  const [isConfirmationModalIsVisible, setIsConfirmationModalIsVisible] =
    useState<boolean>(false); // To show confirmation modal
  const [actionType, setActionType] = useState<string>();

  /**
   * Toggles the task detail modal for a specific row.
   * @param rowIndex - The index of the row to edit
   */
  const textAreaOnclick = (rowIndex: number) => {
    setEditingRowIndex(rowIndex);
    setTaskDetailModal(!showTaskDetailModal);
  };

  /**
     * show confirmation modal
     */
    const handleShowConfirmationModal = (action: string) => {
      setIsConfirmationModalIsVisible(true);
      setActionType(action);
    };
  
  
    /**
     * close confirmation modal
     */
    const handleCloseConfirmationModal = () => {
      setIsConfirmationModalIsVisible(false);
    };
  
    /**
     * handles Rejection note change
     */
    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRejectionNote(e.target.value);
    };


    const manageWholeTimesheetStatus = async () => {
        try {
          const response = await UseReviewTimesheetsServices().manageAllTimesheets(
            userId,
            timeSheetData[0].timesheet_id,
            rejectionNote,
            actionType!
          );
          if(response.status){
            message.success(response.message);
          }else{
            message.error(response.message);
          }
          handleCloseConfirmationModal();
        } catch (error) {
          console.error(error);
        }
      };

  // Menu items for the dropdown
  const menuItems = [
    { key: "approve", label: "Approve" },
    { key: "reject", label: "Reject" },
  ];

  /**
   * Handles the click on the dropdown menu actions.
   * @param e - Menu event object
   * @param id - Timesheet ID
   */
  const handleMenuClick = async (e: { key: string }, id?: string) => {
    if (!id) return;

    const response = await UseReviewTimesheetsServices().manageTimesheetStatus(
      id,
      e.key
    );

    if (response.status) {
      message.success(response.message);
      const updatedTimesheetData = timeSheetData.map((timesheet) => {
        if (timesheet.timesheet_id === id) {
          return {
            ...timesheet,
            status: e.key === "approve" ? "accepted" : "rejected",
          };
        }
        return timesheet;
      });

      setTimesheetData(updatedTimesheetData);
    }
  };

  /**
   * Calculates total hours for a row by summing the entries.
   * @param entries - Array of time entries for a task
   * @returns Total hours in "hh:mm" format
   */
  const calculateTotalHours = (entries: TimeEntry[]) => {
    const totalMinutes = entries.reduce(
      (total, entry) => total + timeToMinutes(entry.hours || "00:00"),
      0
    );
    return minutesToTime(totalMinutes);
  };

  /**
   * Maps time entries to the corresponding week days for display.
   * @param entries - Time entries for a task
   * @param index - Row index
   * @returns Object mapping each weekday to its time entry component
   */
  const mapTimeEntriesToWeek = (
    entries: TimeEntry[],
    index: number
  ): Record<string, ReactNode> => {
    const weekMap: Record<string, ReactNode> = {};
    daysOfWeek.forEach((day, dayIndex) => {
      const entry = entries[dayIndex] || {
        hours: "00:00",
        isHoliday: false,
        date: "",
      };
      weekMap[day.name] = (
        <TimeInput
          value={entry.hours}
          disabled={entry.is_disable}
          tooltipContent={
            entry.is_disable ? "These dates are in next week" : ""
          }
          readOnly={true}
        />
      );
    });
    return weekMap;
  };

  /**
   * Calculates the total hours logged for each day of the week.
   * @returns Object mapping each weekday to its total hours in minutes
   */
  const calculateTotalByDay = () => {
    const dailyTotals: Record<string, number> = {};
    daysOfWeek.forEach((day) => {
      dailyTotals[day.name] = timeSheetData.reduce((total, timesheet) => {
        const dayIndex = daysOfWeek.indexOf(day);
        const dayEntry = timesheet.data_sheet[dayIndex];
        return total + timeToMinutes(dayEntry?.hours || "00:00");
      }, 0);
    });

    return dailyTotals;
  };

  /**
   * Generates the "Total" row for the table, summing hours for all tasks and days.
   * @returns Object representing the total row
   */
  const totalRow = () => {
    const dailyTotals = calculateTotalByDay();
    const totalAllDays = Object.values(dailyTotals).reduce((a, b) => a + b, 0);

    return {
      task: <span className={styles.totalRowTask}>Total</span>,
      details: <span></span>,
      ...Object.fromEntries(
        daysOfWeek.map((day) => [
          day.name,
          <span>{minutesToTime(dailyTotals[day.name])}</span>,
        ])
      ),
      total: (
        <span className={styles.rowWiseTotal}>
          <p>{minutesToTime(totalAllDays)}</p>
        </span>
      ),
      action: <span></span>,
      flag: "rowOfTotal",
    };
  };

  // Define columns for the table
  const columns = [
    { title: "Task", key: "task", width: 140 },
    {
      title: <span style={{ width: "100px" }}>Task Details</span>,
      key: "details",
      width: 155,
    },
    ...daysOfWeek.map((day) => ({
      title: (
        <span
          className={
            day.isHoliday
              ? `${styles.dateTitles} ${styles.holidayDateTitles}` // Holiday styling
              : styles.dateTitles // Default styling
          }
        >
          <p>{day.name}</p>
          <p>{day.formattedDate}</p>
        </span>
      ),
      key: day.name,
    })),
    { title: "Total", key: "total", width: 70 },
    { title: "", key: "action", width: 50 },
  ];

  // Transform timesheet data into rows for the table
  const data = timeSheetData.map((timesheet, index) => {
    const totalHours = calculateTotalHours(timesheet.data_sheet);
    let isDisabled;
    const taskStatusClass =
      timesheet.status === "accepted"
        ? styles.approved
        : timesheet.status === "rejected"
        ? styles.rejected
        : "";

    if (timesheet.status === "accepted" || timesheet.status === "rejected") {
      isDisabled = true;
    } else {
      isDisabled = false;
    }

    return {
      task: (
        <div className={`${styles.tableDataCell} ${taskStatusClass}`}>
          <span className={styles.taskName}>{timesheet.category_name}</span>
          <span className={styles.projectName}>{timesheet.project_name}</span>
        </div>
      ),
      details: (
        <TextAreaButton
          buttonvalue={timesheet.task_detail}
          readOnly={true}
          onclickFunction={() => textAreaOnclick(index)}
          showTaskDetailModal={editingRowIndex === index && showTaskDetailModal}
          value={timeSheetData[index].task_detail}
        />
      ),
      ...mapTimeEntriesToWeek(timesheet.data_sheet, index),
      total: (
        <span className={styles.rowWiseTotal}>
          <p>{totalHours}</p>
        </span>
      ),
      action: (
        <Dropdown
          menu={{
            items: menuItems,
            onClick: (e) => handleMenuClick(e, timesheet.timesheet_id),
          }}
          trigger={["click"]}
          disabled={isDisabled}
        >
          <button
            className={styles.action}
            role="button"
            tabIndex={0}
            disabled={isDisabled}
          >
            <span>{Icons.threeDots}</span>
          </button>
        </Dropdown>
      ),
    };
  });

  return (
    <div className={styles.mainContainer}>
      <div className={styles.scrollContainer}>
        <div className={styles.tableWrapper}>
          <CustomTable columns={columns} data={[...data, totalRow()]} />
        </div>
      </div>
      <div className={styles.timesheetNotesWrapper}>
        <h2>Timesheet Note</h2>
        <textarea
          className={styles.timesheetNote}
          placeholder="Write your timesheet note here."
          value={rejectionNote}
          onChange={handleNoteChange}
        />
      </div>
      <div className={styles.actionButtons}>
        <div>
          <ButtonComponent
            label="Approve"
            theme="black"
            onClick={() => handleShowConfirmationModal("accepted")}
          />
          <ButtonComponent
            label="Reject"
            theme="white"
            onClick={() => handleShowConfirmationModal("rejected")}
          />
        </div>
        <span className={styles.backButton} onClick={backButtonFunction}>
          {" "}
          {"< Back"}
        </span>
      </div>
      <ConfirmationModal
        isVisible={isConfirmationModalIsVisible}
        confirmationType={actionType!}
        cancelationHandlerFunction={handleCloseConfirmationModal}
        confirmationHandlerFunction={manageWholeTimesheetStatus}
      />
    </div>
  );
};

export default PendingDetailedView;
